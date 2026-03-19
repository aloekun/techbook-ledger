//! PostToolUse リンターフック
//!
//! Write/Edit ツール使用後にファイルに対してリンター/フォーマッターを実行し、
//! 診断結果を additionalContext として Claude にフィードバックします。
//!
//! 対応言語:
//!   - TypeScript/JavaScript (.ts, .tsx, .js, .jsx): Biome (format) + oxlint (lint)

use serde::{Deserialize, Serialize};
use std::io::{self, Read};
use std::path::Path;
use std::process::Command;

// --- 入力 ---

#[derive(Deserialize)]
struct HookInput {
    tool_input: Option<ToolInput>,
}

#[derive(Deserialize)]
struct ToolInput {
    file_path: Option<String>,
    path: Option<String>,
}

// --- 出力 ---

#[derive(Serialize)]
struct HookOutput {
    #[serde(rename = "hookSpecificOutput")]
    hook_specific_output: HookSpecificOutput,
}

#[derive(Serialize)]
struct HookSpecificOutput {
    #[serde(rename = "hookEventName")]
    hook_event_name: String,
    #[serde(rename = "additionalContext")]
    additional_context: String,
}

/// ファイル拡張子が TypeScript/JavaScript かどうかを判定
fn is_typescript_js(file: &str) -> bool {
    let ext = Path::new(file)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase());

    matches!(ext.as_deref(), Some("ts" | "tsx" | "js" | "jsx"))
}

/// コマンドを直接実行し、(stdout, stderr) を返す
/// シェル (cmd /c) を経由しないため、ファイルパスのメタ文字によるインジェクションを防止する
fn run_command(program: &str, args: &[&str]) -> (String, String) {
    match Command::new(program).args(args).output() {
        Ok(o) => (
            String::from_utf8_lossy(&o.stdout).to_string(),
            String::from_utf8_lossy(&o.stderr).to_string(),
        ),
        Err(e) => (String::new(), format!("Failed to run {}: {}", program, e)),
    }
}

/// stdout と stderr を適切に結合する
fn combine_output(stdout: &str, stderr: &str) -> String {
    if stdout.is_empty() {
        stderr.to_string()
    } else if stderr.is_empty() {
        stdout.to_string()
    } else if stdout.ends_with('\n') {
        format!("{}{}", stdout, stderr)
    } else {
        format!("{}\n{}", stdout, stderr)
    }
}

/// フィードバック JSON を stdout に出力
fn emit_feedback(message: &str) {
    let output = HookOutput {
        hook_specific_output: HookSpecificOutput {
            hook_event_name: "PostToolUse".to_string(),
            additional_context: message.to_string(),
        },
    };
    if let Ok(json) = serde_json::to_string(&output) {
        println!("{}", json);
    }
}

/// TypeScript/JavaScript 向けリンターパイプライン
fn lint_typescript(file: &str) {
    // 1. Biome でフォーマット (失敗しても続行, --no-install でローカル固定版を使用)
    let _ = run_command("npx", &["--no-install", "biome", "format", "--write", file]);

    // 2. oxlint --fix で自動修正 (失敗しても続行)
    let _ = run_command("npx", &["--no-install", "oxlint", "--fix", file]);

    // 3. oxlint で残りの診断を取得 (stdout + stderr を結合)
    let (stdout, stderr) = run_command("npx", &["--no-install", "oxlint", file]);
    let combined = combine_output(&stdout, &stderr);

    // 診断結果があればフィードバック (先頭20行に制限)
    let trimmed: String = combined.lines().take(20).collect::<Vec<_>>().join("\n");
    if !trimmed.trim().is_empty() {
        emit_feedback(&trimmed);
    }
}

fn main() {
    // stdin を消費（フックの仕様上必須）
    let mut input = String::new();
    let _ = io::stdin().read_to_string(&mut input);

    // JSON からファイルパスを取得
    let hook_input: HookInput = match serde_json::from_str(&input) {
        Ok(v) => v,
        Err(_) => return, // パース失敗 → 何もせず終了
    };

    let file = hook_input
        .tool_input
        .and_then(|t| t.file_path.filter(|s| !s.is_empty()).or(t.path))
        .unwrap_or_default();

    if file.is_empty() {
        return;
    }

    // TypeScript/JavaScript ファイルのみリンターを実行
    if is_typescript_js(&file) {
        lint_typescript(&file);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // --- TypeScript/JavaScript 判定 ---

    #[test]
    fn ts_is_target() {
        assert!(is_typescript_js("src/app.ts"));
    }

    #[test]
    fn tsx_is_target() {
        assert!(is_typescript_js("components/App.tsx"));
    }

    #[test]
    fn js_is_target() {
        assert!(is_typescript_js("index.js"));
    }

    #[test]
    fn jsx_is_target() {
        assert!(is_typescript_js("Component.jsx"));
    }

    // --- 非対象 ---

    #[test]
    fn rs_is_not_target() {
        assert!(!is_typescript_js("main.rs"));
    }

    #[test]
    fn json_is_not_target() {
        assert!(!is_typescript_js("package.json"));
    }

    #[test]
    fn py_is_not_target() {
        assert!(!is_typescript_js("main.py"));
    }

    #[test]
    fn no_extension_is_not_target() {
        assert!(!is_typescript_js("Makefile"));
    }

    #[test]
    fn empty_is_not_target() {
        assert!(!is_typescript_js(""));
    }

    #[test]
    fn windows_path_ts_is_target() {
        assert!(is_typescript_js(r"e:\work\project\src\app.ts"));
    }

    #[test]
    fn case_insensitive_ts() {
        assert!(is_typescript_js("file.TS"));
        assert!(is_typescript_js("file.Tsx"));
    }

    // --- 出力結合 ---

    #[test]
    fn combine_empty_stdout() {
        assert_eq!(combine_output("", "error"), "error");
    }

    #[test]
    fn combine_empty_stderr() {
        assert_eq!(combine_output("output", ""), "output");
    }

    #[test]
    fn combine_both_with_trailing_newline() {
        assert_eq!(combine_output("output\n", "error"), "output\nerror");
    }

    #[test]
    fn combine_both_without_trailing_newline() {
        assert_eq!(combine_output("output", "error"), "output\nerror");
    }

    // --- フィードバック JSON ---

    #[test]
    fn feedback_json_has_correct_structure() {
        let output = HookOutput {
            hook_specific_output: HookSpecificOutput {
                hook_event_name: "PostToolUse".to_string(),
                additional_context: "test diagnostic".to_string(),
            },
        };
        let json = serde_json::to_string(&output).unwrap();
        assert!(json.contains(r#""hookEventName":"PostToolUse""#));
        assert!(json.contains(r#""additionalContext":"test diagnostic""#));
    }
}
