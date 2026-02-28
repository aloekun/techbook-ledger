# Version Control: Jujutsu (jj)

このプロジェクトでは **Jujutsu (jj)** をバージョン管理ツールとして使用する。
`git` コマンドの直接使用は `validate-command` フックによりブロックされる。

## なぜ jj か

- Working copy が自動的に変更を追跡する（`git add` 不要）
- コミットの書き換え・分割・移動が安全にできる
- Git リポジトリと完全に互換（`jj git push/fetch` で連携）

## 基本コマンド対応表

| 目的 | jj コマンド | (参考) git 相当 |
|------|------------|----------------|
| 状態確認 | `jj status` | `git status` |
| 差分確認 | `jj diff` | `git diff` |
| 履歴確認 | `jj log` | `git log` |
| 変更を記述 | `jj describe -m "message"` | `git commit -m "message"` |
| 新しい変更を開始 | `jj new` | (自動。次の作業開始) |
| ブックマーク作成 | `jj bookmark create <name>` | `git branch <name>` |
| ブックマーク移動 | `jj bookmark set <name>` | `git branch -f <name>` |
| リモートに push | `jj git push --bookmark <name>` | `git push` |
| リモートから fetch | `jj git fetch` | `git fetch` |
| 変更を親に統合 | `jj squash` | `git commit --amend` / `rebase -i` |

## ブランチ（ブックマーク）ワークフロー

### 新しい作業ブランチの作成

```bash
# 1. develop の最新を取得
jj git fetch

# 2. 作業して変更を記述
jj describe -m "feat(scope): 説明"

# 3. ブックマークを作成（変更を記述した後に作成すること）
jj bookmark create feature/N-description

# 4. 新しい変更を開始
jj new

# 5. リモートに push（初回は --allow-new が必要）
jj git push --bookmark feature/N-description --allow-new
```

### 既存ブランチへの追加コミット

```bash
# 1. 変更を加える（working copy に自動反映）
# 2. 変更を記述
jj describe -m "fix(scope): 追加修正"

# 3. 親コミットに統合する場合
jj squash

# 4. ブックマークを現在の変更に移動
jj bookmark set <name> --allow-backwards

# 5. push
jj git push --bookmark <name>
```

## 注意事項

### ブックマーク作成のタイミング

`jj bookmark create` は **変更を `jj describe` した後** に実行する。
先に作成すると空コミットにブックマークが付き、後で移動する際に `--allow-backwards` が必要になる。

### 初回 push には --allow-new が必要

リモートに存在しないブックマークを push する際は `--allow-new` フラグが必須。
jj の安全機構で、意図しないリモートブックマーク作成を防いでいる。

### jj git push はユーザー承認が必要

`jj git push` は allow リストに含めていない。
最終的な push 判断はユーザーが行うため、実行時に承認プロンプトが表示される。

### PR 作成は gh CLI を使う

```bash
gh pr create --base develop --head <bookmark-name> --title "..." --body "..."
```

jj は GitHub PR を直接作成する機能を持たないため、`gh` CLI を使用する。

## フックによる git ブロック

`.claude/hooks-rs/src/main.rs` の `validate-command` フックが全ての Bash コマンドを検証する。
`&&`, `;`, `||`, `&` でチェーンされた git コマンドもブロック対象。

ブロック対象外:
- `jj git push` / `jj git fetch` など jj 経由の操作
- `gh` CLI（GitHub API 操作）
