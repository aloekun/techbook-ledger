//! コマンド検証フック
//!
//! Bashコマンド実行前に危険なコマンドをブロックします。
//!
//! 終了コード:
//!   0 - コマンドを許可
//!   2 - コマンドをブロック（stderrのメッセージがClaudeに表示される）
//!
//! MIT License - based on xiaobei930/claude-code-best-practices

use regex::Regex;
use serde::Deserialize;
use std::io::{self, Read, Write};
use std::process::ExitCode;

#[derive(Deserialize)]
struct HookInput {
    tool_name: Option<String>,
    tool_input: Option<ToolInput>,
}

#[derive(Deserialize)]
struct ToolInput {
    command: Option<String>,
    file_path: Option<String>,
    path: Option<String>,
}

struct BlockedPattern {
    pattern: Regex,
    message: &'static str,
}

fn get_blocked_patterns() -> Vec<BlockedPattern> {
    vec![
        BlockedPattern {
            // 結合フラグ形式: -rf, -fr, -Rrf など（コマンド境界でのみマッチ）
            pattern: Regex::new(r"(?im)(^|&&|;|\|\||\||&)\s*rm\s+(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r)(\s|$)").unwrap(),
            message: r#"**rm -rf コマンドがブロックされました**

このコマンドは再帰的に強制削除を行うため、重要なファイルを失う可能性があります。

**安全な代替方法:**
- 削除前にファイル一覧を確認: `ls -la <path>`
- 単一ファイルの削除: `rm <file>`
- 確認付き削除: `rm -ri <directory>`
- ゴミ箱への移動を検討"#,
        },
        BlockedPattern {
            // 分割フラグ形式: rm -r -f（コマンド境界でのみマッチ）
            pattern: Regex::new(r"(?im)(^|&&|;|\|\||\||&)\s*rm\s+(-[a-zA-Z]*\s+)*-[a-zA-Z]*r[a-zA-Z]*\s+(-[a-zA-Z]*\s+)*-[a-zA-Z]*f[a-zA-Z]*(\s|$)").unwrap(),
            message: r#"**rm -rf コマンドがブロックされました**

このコマンドは再帰的に強制削除を行うため、重要なファイルを失う可能性があります。

**安全な代替方法:**
- 削除前にファイル一覧を確認: `ls -la <path>`
- 単一ファイルの削除: `rm <file>`
- 確認付き削除: `rm -ri <directory>`
- ゴミ箱への移動を検討"#,
        },
        BlockedPattern {
            // 分割フラグ逆順形式: rm -f -r（コマンド境界でのみマッチ）
            pattern: Regex::new(r"(?im)(^|&&|;|\|\||\||&)\s*rm\s+(-[a-zA-Z]*\s+)*-[a-zA-Z]*f[a-zA-Z]*\s+(-[a-zA-Z]*\s+)*-[a-zA-Z]*r[a-zA-Z]*(\s|$)").unwrap(),
            message: r#"**rm -rf コマンドがブロックされました**

このコマンドは再帰的に強制削除を行うため、重要なファイルを失う可能性があります。

**安全な代替方法:**
- 削除前にファイル一覧を確認: `ls -la <path>`
- 単一ファイルの削除: `rm <file>`
- 確認付き削除: `rm -ri <directory>`
- ゴミ箱への移動を検討"#,
        },
        BlockedPattern {
            // シェルラッパー経由の git: bash -c 'git push', bash -lc 'git status' など
            pattern: Regex::new(r#"(?i)\b(bash|sh)\s+-[a-zA-Z]*c[a-zA-Z]*\s+["'][^"']*\bgit\s+"#).unwrap(),
            message: r#"**git コマンドがブロックされました（シェルラッパー経由）**

このプロジェクトでは Jujutsu (jj) をバージョン管理に使用しています。
`bash -c 'git ...'` 等のラッパー経由でも git コマンドは使用できません。

詳細は CLAUDE.md の "Version Control" セクションを参照してください。"#,
        },
        BlockedPattern {
            pattern: Regex::new(r#"(?i)(^|&&|;|\|\||\||&)\s*(?:[A-Za-z_][A-Za-z0-9_]*=\S+\s+|command\s+|env\s+)*git\s+"#).unwrap(),
            message: r#"**git コマンドがブロックされました**

このプロジェクトでは Jujutsu (jj) をバージョン管理に使用しています。
git コマンドを直接使用すると、バージョン履歴に不整合が生じる可能性があります。

**jj コマンドの代替:**
| git コマンド | jj コマンド |
|-------------|------------|
| git status | jj status |
| git log | jj log |
| git diff | jj diff |
| git add + commit | jj describe -m "message" && jj new |
| git push | jj git push |
| git fetch | jj git fetch |

詳細は CLAUDE.md の "Version Control" セクションを参照してください。"#,
        },
        BlockedPattern {
            pattern: Regex::new(r"(?i)(^|&&|;|\|\||&)\s*cd\s+/d\s").unwrap(),
            message: r#"**cd /d コマンドがブロックされました**

`cd /d` は Windows のコマンドプロンプト固有の構文で、Claude Code の bash 環境では動作しません。

**代替方法:**
- 単純にディレクトリを変更: `cd <path>`
- または絶対パスでコマンドを実行してください

**例:**
```
# NG: cd /d e:\work\project && npm run lint
# OK: cd /e/work/project && npm run lint
# OK: npm run lint --prefix /e/work/project
```"#,
        },
        // jj --ignore-immutable (immutable commits の保護バイパスを禁止)
        BlockedPattern {
            pattern: Regex::new(r"(?is)\bjj\b.*--ignore-immutable").unwrap(),
            message: r#"**jj --ignore-immutable がブロックされました**

immutable commits（main 等）の書き換え保護を無効化するオプションのため、使用が禁止されています。

immutable commits を変更する必要がある場合は、ユーザーに確認を取ってください。"#,
        },
        // 第2層: jj new main (ローカル main からの派生を禁止)
        // main@origin は許可。jj new main / pnpm jj-new main をブロック。クォート形式も対象。
        BlockedPattern {
            pattern: Regex::new(r#"(?i)(jj\s+new|pnpm\s+jj-new)\s+(?:"main"|'main'|main)(?:\s|$)"#).unwrap(),
            message: r#"**jj new main がブロックされました**

ローカルの main ブックマークをベースに change を作成することは禁止されています。
ローカル main はリモートより古い可能性があり、先祖返りの原因になります。

**正しい作業開始コマンド:**
```
bash .claude/scripts/jj-start-change.sh
```

これにより origin/main を fetch してから新しい change を作成します。
詳細は CLAUDE.md の "バージョン管理" セクションを参照してください。"#,
        },
        // 第3層: jj edit main (ローカル main の直接編集を禁止)
        // クォート形式も対象。
        BlockedPattern {
            pattern: Regex::new(r#"(?i)(jj\s+edit|pnpm\s+jj-edit)\s+(?:"main"|'main'|main)(?:\s|$)"#).unwrap(),
            message: r#"**jj edit main がブロックされました**

main ブックマークが指す commit を直接編集することは禁止されています。
編集すると main の内容が変わり、履歴の破損や先祖返りの原因になります。

**正しい作業開始コマンド:**
```
bash .claude/scripts/jj-start-change.sh
```

これにより origin/main をベースに新しい change を作成します。
詳細は CLAUDE.md の "バージョン管理" セクションを参照してください。"#,
        },
    ]
}

fn validate_command(command: &str, patterns: &[BlockedPattern]) -> Option<&'static str> {
    for pattern in patterns {
        if pattern.pattern.is_match(command) {
            return Some(pattern.message);
        }
    }
    None
}

/// リンター/フォーマッター設定ファイルとして保護する対象
const PROTECTED_CONFIG_FILES: &[&str] = &[
    // JavaScript / TypeScript
    ".eslintrc",
    ".eslintrc.js",
    ".eslintrc.cjs",
    ".eslintrc.json",
    ".eslintrc.yml",
    ".eslintrc.yaml",
    "eslint.config.js",
    "eslint.config.mjs",
    "eslint.config.cjs",
    "eslint.config.ts",
    "eslint.config.mts",
    "eslint.config.cts",
    ".prettierrc",
    ".prettierrc.js",
    ".prettierrc.cjs",
    ".prettierrc.json",
    ".prettierrc.yml",
    ".prettierrc.yaml",
    "prettier.config.js",
    "prettier.config.cjs",
    "biome.json",
    "biome.jsonc",
    "tsconfig.json",
    "tsconfig.build.json",
    // Git hooks / pre-commit
    "lefthook.yml",
    "lefthook.yaml",
    ".pre-commit-config.yaml",
    ".husky",
    // Python
    "pyproject.toml",
    ".flake8",
    ".pylintrc",
    "setup.cfg",
    // Rust
    "rustfmt.toml",
    ".rustfmt.toml",
    "clippy.toml",
    ".clippy.toml",
    // Go
    ".golangci.yml",
    ".golangci.yaml",
    // Swift
    ".swiftlint.yml",
    ".swiftlint.yaml",
    // Secrets / Environment
    ".env",
    ".env.local",
    ".env.development",
    ".env.production",
    ".env.staging",
    ".env.test",
    // Claude Code hook wiring (editing these disables guardrails)
    "settings.local.json",
    "settings.local.json.template",
];

/// ファイルパスが保護対象の設定ファイルに該当するか判定
fn is_protected_config(file_path: &str) -> bool {
    // パスを正規化（Windows \ → / に統一し、小文字化）
    let normalized = file_path.replace('\\', "/");
    let normalized_lower = normalized.to_ascii_lowercase();

    // ファイル名部分を取得
    let file_name = normalized_lower
        .rsplit('/')
        .next()
        .unwrap_or(&normalized_lower);

    PROTECTED_CONFIG_FILES.iter().any(|&protected| {
        let protected_lower = protected.to_ascii_lowercase();
        if protected == ".husky" {
            // ディレクトリエントリ: ファイル名一致 or パスコンポーネントとして含まれるか
            let dir_prefix = format!("{}/", protected_lower);
            file_name == protected_lower
                || normalized_lower.contains(&format!("/{}", dir_prefix))
                || normalized_lower.starts_with(&dir_prefix)
        } else {
            file_name == protected_lower
        }
    })
}

fn main() -> ExitCode {
    // stdinからJSONを読み込む
    let mut input = String::new();
    if let Err(e) = io::stdin().read_to_string(&mut input) {
        eprintln!("[validate-command] Error: Failed to read stdin: {}", e);
        return ExitCode::FAILURE;
    }

    // JSONをパース
    let hook_input: HookInput = match serde_json::from_str(&input) {
        Ok(v) => v,
        Err(e) => {
            eprintln!("[validate-command] Error: Failed to parse JSON: {}", e);
            return ExitCode::FAILURE;
        }
    };

    let tool_name = hook_input.tool_name.unwrap_or_default();
    let tool_input = hook_input.tool_input.unwrap_or(ToolInput {
        command: None,
        file_path: None,
        path: None,
    });

    match tool_name.as_str() {
        "Bash" => {
            let command = tool_input.command.unwrap_or_default();
            if command.trim().is_empty() {
                return ExitCode::SUCCESS;
            }

            // コマンドを検証
            let patterns = get_blocked_patterns();
            if let Some(message) = validate_command(&command, &patterns) {
                let _ = io::stderr().write_all(message.as_bytes());
                return ExitCode::from(2);
            }
        }
        "Write" | "Edit" | "Replace" => {
            let file_path = tool_input
                .file_path
                .filter(|s| !s.is_empty())
                .or(tool_input.path)
                .unwrap_or_default();
            if !file_path.is_empty() && is_protected_config(&file_path) {
                let msg = format!(
                    "**保護されたファイルの編集がブロックされました**\n\n\
                     `{}` は保護対象ファイル（設定ファイル/機密ファイル）のため、編集が禁止されています。\n\n\
                     リンター設定の場合: 設定を変更するのではなく **コード側を修正** してください。\n\
                     機密ファイルの場合: 秘密情報の漏洩を防ぐため、編集できません。\n\n\
                     変更が本当に必要な場合は、ユーザーに確認を取ってください。",
                    file_path
                        .rsplit(|c| c == '/' || c == '\\')
                        .next()
                        .unwrap_or(&file_path)
                );
                let _ = io::stderr().write_all(msg.as_bytes());
                return ExitCode::from(2);
            }
        }
        _ => {}
    }

    ExitCode::SUCCESS
}

#[cfg(test)]
mod tests {
    use super::*;

    fn patterns() -> Vec<BlockedPattern> {
        get_blocked_patterns()
    }

    fn is_blocked(command: &str) -> bool {
        validate_command(command, &patterns()).is_some()
    }

    // --- git: direct commands (should block) ---

    #[test]
    fn blocks_git_at_start() {
        assert!(is_blocked("git push"));
    }

    #[test]
    fn blocks_git_status() {
        assert!(is_blocked("git status"));
    }

    // --- git: chained after shell operators (should block) ---

    #[test]
    fn blocks_git_after_ampersand_ampersand() {
        assert!(is_blocked("cd /e/work && git push"));
    }

    #[test]
    fn blocks_git_after_semicolon() {
        assert!(is_blocked("true; git status"));
    }

    #[test]
    fn blocks_git_after_or() {
        assert!(is_blocked("false || git log"));
    }

    #[test]
    fn blocks_git_after_pipe() {
        assert!(is_blocked("echo data | git apply"));
    }

    #[test]
    fn blocks_git_in_triple_chain() {
        assert!(is_blocked("cd /path && echo ok && git commit -m 'test'"));
    }

    #[test]
    fn blocks_git_after_single_ampersand() {
        assert!(is_blocked("echo ok & git status"));
    }

    // --- git: env/command prefix bypass (should block) ---

    #[test]
    fn blocks_git_with_env_prefix() {
        assert!(is_blocked("GIT_TRACE=1 git status"));
    }

    #[test]
    fn blocks_git_with_command_builtin() {
        assert!(is_blocked("command git push"));
    }

    #[test]
    fn blocks_git_with_env_builtin() {
        assert!(is_blocked("env VAR=value git log"));
    }

    #[test]
    fn blocks_git_env_prefix_after_chain() {
        assert!(is_blocked("echo x; GIT_TRACE=1 git diff"));
    }

    // --- git: allowed commands (should NOT block) ---

    #[test]
    fn allows_jj_git_push() {
        assert!(!is_blocked("jj git push"));
    }

    #[test]
    fn allows_jj_git_fetch() {
        assert!(!is_blocked("jj git fetch"));
    }

    #[test]
    fn allows_gh_pr_create() {
        assert!(!is_blocked("gh pr create --title 'test'"));
    }

    #[test]
    fn allows_pnpm_lint() {
        assert!(!is_blocked("pnpm lint"));
    }

    #[test]
    fn allows_jj_status() {
        assert!(!is_blocked("jj status"));
    }

    // --- cd /d: direct and chained (should block) ---

    #[test]
    fn blocks_cd_d_at_start() {
        assert!(is_blocked(r"cd /d e:\work"));
    }

    #[test]
    fn blocks_cd_d_after_ampersand_ampersand() {
        assert!(is_blocked(r"echo ok && cd /d e:\work"));
    }

    // --- rm -rf (should block regardless of position) ---

    #[test]
    fn blocks_rm_rf_at_start() {
        assert!(is_blocked("rm -rf /tmp/test"));
    }

    #[test]
    fn blocks_rm_rf_after_chain() {
        assert!(is_blocked("cd /path && rm -rf /tmp"));
    }

    #[test]
    fn blocks_rm_split_r_then_f() {
        assert!(is_blocked("rm -r -f /tmp/test"));
    }

    #[test]
    fn blocks_rm_split_f_then_r() {
        assert!(is_blocked("rm -f -r /tmp/test"));
    }

    // --- rm -rf false positive prevention ---

    #[test]
    fn allows_echo_rm_rf_in_quotes() {
        assert!(!is_blocked(r#"echo "rm -rf /tmp""#));
    }

    #[test]
    fn allows_grep_rm_rf() {
        assert!(!is_blocked(r#"grep "rm -rf" docs/"#));
    }

    // --- git in shell wrapper (should block) ---

    #[test]
    fn blocks_bash_c_git() {
        assert!(is_blocked("bash -c 'git push'"));
    }

    #[test]
    fn blocks_bash_lc_git() {
        assert!(is_blocked("bash -lc 'git status'"));
    }

    #[test]
    fn blocks_sh_c_git() {
        assert!(is_blocked(r#"sh -c "git log""#));
    }

    // --- jj new main: 第2層 (should block) ---

    #[test]
    fn blocks_jj_new_main() {
        assert!(is_blocked("jj new main"));
    }

    #[test]
    fn blocks_pnpm_jj_new_main() {
        assert!(is_blocked("pnpm jj-new main"));
    }

    #[test]
    fn blocks_jj_new_main_with_flag() {
        assert!(is_blocked("jj new main --no-edit"));
    }

    #[test]
    fn allows_jj_new_origin_main() {
        assert!(!is_blocked("jj new origin/main"));
    }

    #[test]
    fn allows_jj_new_main_at_origin() {
        // main@origin は許可（jj のリモートトラッキング形式）
        assert!(!is_blocked("jj new main@origin"));
    }

    #[test]
    fn blocks_jj_new_main_single_quoted() {
        assert!(is_blocked("jj new 'main'"));
    }

    #[test]
    fn blocks_pnpm_jj_new_main_double_quoted() {
        assert!(is_blocked("pnpm jj-new \"main\""));
    }

    #[test]
    fn allows_jj_new_feature_branch() {
        assert!(!is_blocked("jj new feature/foo"));
    }

    #[test]
    fn allows_jj_new_mainline() {
        // "mainline" は main とは別なので許可
        assert!(!is_blocked("jj new mainline"));
    }

    // --- jj edit main: 第3層 (should block) ---

    #[test]
    fn blocks_jj_edit_main() {
        assert!(is_blocked("jj edit main"));
    }

    #[test]
    fn blocks_pnpm_jj_edit_main() {
        assert!(is_blocked("pnpm jj-edit main"));
    }

    #[test]
    fn allows_jj_edit_feature_branch() {
        assert!(!is_blocked("jj edit feature/foo"));
    }

    // --- jj --ignore-immutable (should block) ---

    #[test]
    fn blocks_jj_ignore_immutable() {
        assert!(is_blocked("jj --ignore-immutable rebase -r abc -d main"));
    }

    #[test]
    fn blocks_jj_ignore_immutable_after_subcommand() {
        assert!(is_blocked("jj rebase --ignore-immutable -r abc -d main"));
    }

    #[test]
    fn allows_jj_rebase_without_ignore_immutable() {
        assert!(!is_blocked("jj rebase -r abc -d main"));
    }

    // --- safe commands (should NOT block) ---

    #[test]
    fn allows_empty_command() {
        assert!(!is_blocked(""));
    }

    #[test]
    fn allows_ls() {
        assert!(!is_blocked("ls -la"));
    }

    #[test]
    fn allows_cd_normal() {
        assert!(!is_blocked("cd /e/work/project"));
    }

    // --- protected config files (should block Write/Edit) ---

    #[test]
    fn protects_eslint_config() {
        assert!(is_protected_config("eslint.config.js"));
    }

    #[test]
    fn protects_eslintrc_json() {
        assert!(is_protected_config(".eslintrc.json"));
    }

    #[test]
    fn protects_biome_json() {
        assert!(is_protected_config("biome.json"));
    }

    #[test]
    fn protects_prettierrc() {
        assert!(is_protected_config(".prettierrc"));
    }

    #[test]
    fn protects_tsconfig() {
        assert!(is_protected_config("tsconfig.json"));
    }

    #[test]
    fn protects_pyproject_toml() {
        assert!(is_protected_config("pyproject.toml"));
    }

    #[test]
    fn protects_rustfmt_toml() {
        assert!(is_protected_config("rustfmt.toml"));
    }

    #[test]
    fn protects_golangci_yml() {
        assert!(is_protected_config(".golangci.yml"));
    }

    #[test]
    fn protects_lefthook_yml() {
        assert!(is_protected_config("lefthook.yml"));
    }

    #[test]
    fn protects_pre_commit_config() {
        assert!(is_protected_config(".pre-commit-config.yaml"));
    }

    #[test]
    fn protects_with_windows_path() {
        assert!(is_protected_config(r"e:\work\project\biome.json"));
    }

    #[test]
    fn protects_with_unix_path() {
        assert!(is_protected_config("/home/user/project/.eslintrc.json"));
    }

    #[test]
    fn allows_regular_ts_file() {
        assert!(!is_protected_config("src/app.ts"));
    }

    #[test]
    fn allows_regular_json_file() {
        assert!(!is_protected_config("src/data.json"));
    }

    #[test]
    fn allows_package_json() {
        assert!(!is_protected_config("package.json"));
    }

    #[test]
    fn protects_env() {
        assert!(is_protected_config(".env"));
    }

    #[test]
    fn protects_env_local() {
        assert!(is_protected_config(".env.local"));
    }

    #[test]
    fn protects_env_production() {
        assert!(is_protected_config(".env.production"));
    }

    #[test]
    fn protects_env_with_path() {
        assert!(is_protected_config(r"e:\work\project\.env"));
    }

    // --- regression: .husky ディレクトリ内ファイルの保護 ---

    #[test]
    fn protects_husky_pre_commit() {
        assert!(is_protected_config(".husky/pre-commit"));
    }

    #[test]
    fn protects_husky_with_absolute_path() {
        assert!(is_protected_config("/home/user/project/.husky/pre-commit"));
    }

    #[test]
    fn protects_husky_with_windows_path() {
        assert!(is_protected_config(r"e:\work\project\.husky\pre-commit"));
    }

    // --- regression: case-insensitive 保護 ---

    #[test]
    fn protects_uppercase_husky() {
        assert!(is_protected_config(".HUSKY/pre-commit"));
    }

    #[test]
    fn protects_uppercase_eslintrc() {
        assert!(is_protected_config(".ESLINTRC.JSON"));
    }

    #[test]
    fn protects_mixed_case_biome() {
        assert!(is_protected_config("Biome.Json"));
    }

    // --- Claude Code hook wiring 保護 ---

    #[test]
    fn protects_claude_settings_template() {
        assert!(is_protected_config(".claude/settings.local.json.template"));
    }

    #[test]
    fn protects_claude_settings_local_json() {
        assert!(is_protected_config(r"e:\work\project\.claude\settings.local.json"));
    }

    // --- regression: jj --ignore-immutable dotall ---

    #[test]
    fn blocks_jj_ignore_immutable_multiline() {
        assert!(is_blocked("jj rebase\n--ignore-immutable -r abc -d main"));
    }
}
