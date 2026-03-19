# Auto Review Fix: 知見まとめ

Code Rabbit + Claude Code Action による自動レビュー修正ワークフローの構築で得られた知見。
別プロジェクトでの再利用を想定して記録する。

## 1. ワークフローのトリガー条件

- `pull_request_review` イベントはベースブランチのワークフローファイルを参照する。PR ブランチにワークフローを追加しても、マージするまで発火しない
- Code Rabbit はデフォルトで `COMMENTED` 状態でレビューする。`CHANGES_REQUESTED` にするには `.coderabbit.yaml` に `reviews.request_changes_workflow: true` が必要
- ワークフローの `if` 条件は両方 (`changes_requested || commented`) をカバーすべき

## 2. Code Rabbit の挙動

- **同一コミットへの再レビューはしない**: `@coderabbitai review` を何度実行しても、同じ SHA に対しては新しいレビューを投稿しない。新しいコミットのプッシュが必要
- **レビュー一時停止**: コミット数が多いブランチでは `auto_pause_after_reviewed_commits` により自動的にレビューが一時停止される。`@coderabbitai resume` または `@coderabbitai review` で再開できるが、上記の同一コミット制約が適用される
- **レビューの dismiss**: `CHANGES_REQUESTED` レビューが残っていると branch protection でマージがブロックされる。GitHub API で dismiss 可能

## 3. Claude Code Action (anthropics/claude-code-action@v1)

- `allowed_tools` input は v1 で deprecated。`claude_args` に `--allowedTools` を渡す
- デフォルトで自動許可されるツール: `Edit`, `Read`, `Write`, `Glob`, `Replace`, `NotebookEditCell`, `Bash(git add)`, `Bash(git commit)`, `Bash(git push)`
- `--allowedTools` はデフォルトに**追加**する形式。置き換えではない
- 任意の Bash 実行はデフォルトで無効。明示的に `Bash(jj:*)` 等で許可が必要

## 4. CI 環境での settings.local.json 問題

- Claude Code Action はリポジトリの `.claude/settings.local.json` を読み込む（`settingSources: ["user", "project", "local"]`）
- ローカル開発用の `PreToolUse` フック（Windows バイナリ等）が含まれていると、Linux CI で実行失敗し全ての Bash ツールが permission denied になる
- **対策**: `.claude/settings.local.json` を `.gitignore` に追加してリポジトリから除外する。マシン固有の設定は tracking すべきでない

## 5. jj (Jujutsu) の CI インストール

- musl バイナリをダウンロード: `jj-${VERSION}-x86_64-unknown-linux-musl.tar.gz`
- tar のパス指定に注意: アーカイブ内は `./jj`（dot-slash 付き）
- `jj config set` は値を TOML として解釈する。`github-actions[bot]` の `[bot]` が TOML セクションヘッダとして解釈されるため、`'"github-actions[bot]"'` のように TOML 文字列として引用が必要
- `jj git init --colocate` で既存 git リポジトリと共存

## 6. ループ防止メカニズム

- 修正 push → Code Rabbit 再レビュー → 再修正の無限ループが発生しうる
- PR body に `<!-- claude-autofix-count:N -->` を埋め込んでカウント管理
- 上限到達時は `needs-human-review` ラベル付与 + コメント通知
- **ラベルは事前にリポジトリに作成しておく必要がある**。未作成だと `gh pr edit --add-label` が失敗しワークフロー全体が failure になる

## 7. ワークフロー実行コスト

| Run | 結果 | 原因 | コスト |
|-----|------|------|--------|
| tar パスエラー | failure | `./jj` 未指定 | 最小 |
| TOML パースエラー | failure | `[bot]` 引用不足 | 最小 |
| permission denied x5 | failure | settings.local.json フック | $1.35 |

permission denied は Claude Code Action が全ターンを消費するため最もコストが高い。設定ファイル系の問題は最優先で排除すべき。

## 8. 未解決・今後の課題

- `@coderabbitai review` 後も新しいレビューが発火しないケースがある。Code Rabbit 側のレート制限・キャッシュの可能性
- `workflow_dispatch` は `github.event.review.*` が存在しないため、現在の `if` 条件ではジョブがスキップされる。手動トリガーが必要なら `github.event_name` での分岐が必要
- `concurrency` グループで同一 PR の並列実行を防止する設計は有効だが、現在の develop 版ワークフローからは除去されている
