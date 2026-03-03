# Auto Review Fix Specification

Code Rabbit のレビュー指摘を Claude Code Action で自動修正する仕組みの設計仕様。
リポジトリ横断で流用可能な汎用設計とする。

## Overview

```
Developer が PR 作成
  -> Code Rabbit が自動レビュー
  -> changes_requested / commented の場合 GitHub Actions 発火
  -> インラインコメント有無を確認 (walkthrough のみなら skip)
  -> PR body のメタ情報からループカウントを取得
  -> 上限未満なら Claude Code Action でコード修正 + カウント更新
  -> 上限以上ならスキップ -> コメント + ラベルで通知
  -> Claude が修正コミット・プッシュ
  -> CI 実行 -> branch protection で必須チェック通過
  -> Code Rabbit が再レビュー（自然なループ）
  -> Code Rabbit が approved -> GitHub Auto-merge
```

## Prerequisites

- Code Rabbit がリポジトリに導入済みで、auto review が有効
- `.coderabbit.yaml` に `request_changes_workflow: true` を設定（Code Rabbit が `CHANGES_REQUESTED` で返すようにする）
- Code Rabbit がプッシュ後に再レビューする設定であること（ループの起点になる）
- GitHub Secrets に `ANTHROPIC_API_KEY` が登録済み
- Branch protection で CI チェック必須、Auto-merge 有効

## Trigger

```yaml
on:
  pull_request_review:
    types: [submitted]
  workflow_dispatch:

jobs:
  fix-review:
    if: >
      github.event.review.user.login == 'coderabbitai[bot]'
      && (github.event.review.state == 'changes_requested'
        || github.event.review.state == 'commented')
    runs-on: ubuntu-latest
    steps:
      # ... (後述)
```

- `changes_requested` と `commented` に反応する
- Code Rabbit は再レビュー時に `commented` 状態で指摘を返すことがあるため、両方をカバーする
- `approved` では発火しない
- `commented` の walkthrough 誤発火はインラインコメント確認ステップで防止する

## Actionable Comments Check

`commented` 状態のレビューには walkthrough（要約のみ）も含まれるため、インラインコメントの有無を確認してからClaude を起動する。

```yaml
- name: Check for actionable comments
  id: check-actionable
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  run: |
    COMMENTS=$(gh api "repos/$REPO/pulls/$PR/reviews/$REVIEW_ID/comments" --jq 'length')
    if [ "$COMMENTS" -eq 0 ]; then
      echo "has_actionable=false"  # walkthrough のみ → skip
    else
      echo "has_actionable=true"   # コード指摘あり → 続行
    fi
```

GitHub API `GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}/comments` でレビューのインラインコメント数を取得。walkthrough はインラインコメント 0、コード指摘はインラインコメント > 0。

## Loop Count Management

### 方式: PR body メタ情報

PR body の末尾に HTML コメントとしてカウントを埋め込む。

```html
<!-- claude-autofix-count:0 -->
```

### ワークフロー内の処理

1. `gh pr view` で PR body を取得
2. 正規表現 `<!-- claude-autofix-count:(\d+) -->` でカウント抽出（なければ 0）
3. カウント < 上限 -> 修正を実行し、カウント +1 で PR body を更新
4. カウント >= 上限 -> スキップし、通知処理へ

### この方式を選んだ理由

| 方式 | 問題点 |
|------|--------|
| コメント履歴カウント | コメント削除でズレる、他人のコメントと混在、修正のみの場合カウント不能 |
| ラベル方式 (autofix-1 等) | ラベル数が増える、削除忘れで詰まる、手動操作で壊れる |
| **PR body メタ情報** | PR 単位で完全管理、他に影響されない、1 箇所に集約、デバッグ容易 |

## Loop Limit

- デフォルト上限: **3 回**
- 上限到達時の動作:
  1. PR にコメントを投稿（「自動修正の上限に達しました。手動での確認をお願いします。」）
  2. PR に `needs-human-review` ラベルを付与

## Safety Layers

多層防御で暴走・コスト超過を防止する。

```
Layer 1: インラインコメント確認   - walkthrough のみのレビューを除外 (コスト 0)
Layer 2: --max-turns 10          - Claude のターン数上限 (公式デフォルト)
Layer 3: --allowedTools 制限      - 必要最小限のツールのみ許可 (permission denial 防止)
Layer 4: timeout-minutes: 10     - ジョブ全体の時間上限
Layer 5: ループカウント上限 3     - PR body メタ情報で繰り返し修正を制限
Layer 6: concurrency group       - 同一 PR の並列実行防止
Layer 7: プロンプト制約           - 最小限の修正のみ許可 + CI 環境指示
Layer 8: 上限時通知              - コメント + ラベルで人間に引き継ぎ
```

## Tool Permissions

CI 環境では Claude が使用できるツールを `--allowedTools` で明示的に制限する。

**デフォルトで自動許可されるツール:**
- `Edit`, `Read`, `Write`, `Glob`, `Replace`, `NotebookEditCell`
- `Bash(git add)`, `Bash(git commit)`, `Bash(git push)`

**追加で許可するツール:**
- `Bash(jj:*)` - 全 jj 操作（ローカル開発と同じ VCS ツールを使用）
- `Bash(git:*)` - 全 git 操作（jj の内部操作で必要な場合のバックアップ）
- `Grep` - ファイル内容の検索

**許可しないツール:**
- `Bash(pnpm:*)`, `Bash(npm:*)` 等 - ビルド・テスト実行は不要
- `WebSearch`, `WebFetch` - 外部アクセスは不要

`--allowedTools` を明示しないと、Claude が許可されていないツールを試行し permission denial でターンを浪費する。

## jj (Jujutsu) in CI

ローカル開発と CI で同じ VCS ツールを使うことで、CLAUDE.md の指示との矛盾を排除し一貫性を保つ。

**セットアップ手順:**
1. `actions/checkout` で PR ブランチをチェックアウト
2. jj バイナリをダウンロード（musl 版、数秒で完了）
3. `jj git init --colocate` で既存の git リポジトリに jj を並行セットアップ
4. `jj config set --repo` でユーザー情報を設定
5. `.claude/settings.local.json` を空オブジェクトで上書き（ローカル開発用の hook・権限設定を CI で無効化）

**バージョン管理:**
- jj のバージョンは環境変数 `JJ_VERSION` でピン止め
- 更新時はこの値を変更するだけで良い

**CI での settings.local.json 上書きが必要な理由:**
- リポジトリに `.claude/settings.local.json` が追跡されている場合、ローカル開発用の `PreToolUse` hook や `permissions.allow` リストが CI にも適用される
- `validate-command.exe` (Windows バイナリ) の hook が Linux CI で実行失敗 → 全 Bash ツール呼び出しが permission denied になる
- CI では `--allowedTools` でツール許可を制御するため、ローカル設定は不要

## Prompt Constraints

Claude Code Action に渡すプロンプトには以下の制約を必ず含める。

```
Constraints:
- 必要最小限の修正のみ行うこと
- レビュー指摘があったファイル以外は変更しないこと
- 大規模リファクタリングは禁止
- 新機能の追加やコードスタイルの大幅変更はしないこと
```

CI 環境に jj をインストール済みのため、CLAUDE.md の VCS 指示がそのまま適用される。プロンプトでの VCS 上書き指示は不要。

## Merge Strategy

- GitHub Auto-merge を利用する
- Branch protection の必須チェック（CI、Code Rabbit approved 等）が全て通れば自動マージ
- 手動マージに切り替えたい場合は Auto-merge を無効化するだけで良い

## Repository Setup

各リポジトリで必要な設定:

| 設定対象 | 内容 |
|---------|------|
| `.github/workflows/fix-review.yml` | 本仕様に基づくワークフロー定義 |
| `.coderabbit.yaml` | auto review 有効、`request_changes_workflow: true`、再レビュー有効 |
| GitHub Secrets | `ANTHROPIC_API_KEY` |
| Branch protection | CI チェック必須、Auto-merge 有効 |

## Workflow Example

```yaml
name: Auto Fix Review

on:
  pull_request_review:
    types: [submitted]
  workflow_dispatch:

concurrency:
  group: autofix-${{ github.event.pull_request.number }}
  cancel-in-progress: false

permissions:
  contents: write
  pull-requests: write
  issues: write

jobs:
  fix-review:
    if: >
      github.event.review.user.login == 'coderabbitai[bot]'
      && (github.event.review.state == 'changes_requested'
        || github.event.review.state == 'commented')
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - name: Check for actionable comments
        id: check-actionable
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          PR_NUMBER=${{ github.event.pull_request.number }}
          REVIEW_ID=${{ github.event.review.id }}
          REPO="${{ github.repository }}"
          COMMENTS=$(gh api "repos/$REPO/pulls/$PR_NUMBER/reviews/$REVIEW_ID/comments" --jq 'length')
          echo "comment_count=$COMMENTS" >> "$GITHUB_OUTPUT"
          if [ "$COMMENTS" -eq 0 ]; then
            echo "has_actionable=false" >> "$GITHUB_OUTPUT"
          else
            echo "has_actionable=true" >> "$GITHUB_OUTPUT"
          fi

      - name: Check loop count
        if: steps.check-actionable.outputs.has_actionable == 'true'
        id: check-count
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          PR_NUMBER=${{ github.event.pull_request.number }}
          BODY=$(gh pr view "$PR_NUMBER" --repo "${{ github.repository }}" --json body -q '.body')
          COUNT=$(printf '%s' "$BODY" | grep -oP '<!-- claude-autofix-count:\K\d+' | tail -n1 || true)
          COUNT=${COUNT:-0}
          echo "count=$COUNT" >> "$GITHUB_OUTPUT"
          if [ "$COUNT" -ge 3 ]; then
            echo "limit_reached=true" >> "$GITHUB_OUTPUT"
          else
            echo "limit_reached=false" >> "$GITHUB_OUTPUT"
          fi

      - name: Notify limit reached
        if: >
          steps.check-actionable.outputs.has_actionable == 'true'
          && steps.check-count.outputs.limit_reached == 'true'
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          PR_NUMBER=${{ github.event.pull_request.number }}
          REPO="${{ github.repository }}"
          gh pr comment "$PR_NUMBER" --repo "$REPO" \
            --body "Auto-fix has reached the maximum retry limit (3). Please review manually."
          gh pr edit "$PR_NUMBER" --repo "$REPO" --add-label "needs-human-review"

      - name: Checkout repository
        if: >
          steps.check-actionable.outputs.has_actionable == 'true'
          && steps.check-count.outputs.limit_reached == 'false'
        uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.ref }}

      - name: Install and configure jj
        if: >
          steps.check-actionable.outputs.has_actionable == 'true'
          && steps.check-count.outputs.limit_reached == 'false'
        env:
          JJ_VERSION: "v0.38.0"
        run: |
          curl -LsSf "https://github.com/jj-vcs/jj/releases/download/${JJ_VERSION}/jj-${JJ_VERSION}-x86_64-unknown-linux-musl.tar.gz" \
            | tar xzf - --strip-components=0 -C /usr/local/bin ./jj
          chmod +x /usr/local/bin/jj
          jj git init --colocate
          jj config set --repo user.name '"github-actions[bot]"'
          jj config set --repo user.email '"41898282+github-actions[bot]@users.noreply.github.com"'

      - name: Clear local settings for CI
        if: >
          steps.check-actionable.outputs.has_actionable == 'true'
          && steps.check-count.outputs.limit_reached == 'false'
        run: |
          echo '{}' > .claude/settings.local.json

      - name: Run Claude Code Action
        if: >
          steps.check-actionable.outputs.has_actionable == 'true'
          && steps.check-count.outputs.limit_reached == 'false'
        uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          github_token: ${{ secrets.GITHUB_TOKEN }}
          allowed_bots: "coderabbitai[bot]"
          claude_args: |
            --max-turns 10
            --allowedTools "Bash(jj:*),Bash(git:*),Grep"
          prompt: |
            This PR has received review feedback from Code Rabbit.
            Fix the issues pointed out in the review comments.

            Constraints:
            - Only make minimal changes necessary to address the review comments
            - Do not modify files that are not mentioned in the review
            - Do not perform large-scale refactoring
            - Do not add new features or make major code style changes

      - name: Increment loop count
        if: >
          steps.check-actionable.outputs.has_actionable == 'true'
          && steps.check-count.outputs.limit_reached == 'false'
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          PR_NUMBER=${{ github.event.pull_request.number }}
          REPO="${{ github.repository }}"
          BODY=$(gh pr view "$PR_NUMBER" --repo "$REPO" --json body -q '.body')
          COUNT=${{ steps.check-count.outputs.count }}
          NEW_COUNT=$((COUNT + 1))

          if echo "$BODY" | grep -q '<!-- claude-autofix-count:'; then
            NEW_BODY=$(printf '%s' "$BODY" | sed -E "s/<!-- claude-autofix-count:[0-9]+ -->/<!-- claude-autofix-count:$NEW_COUNT -->/g")
          else
            NEW_BODY="${BODY}
          <!-- claude-autofix-count:$NEW_COUNT -->"
          fi

          gh pr edit "$PR_NUMBER" --repo "$REPO" --body "$NEW_BODY"
```

## Known Limitations

- Claude Code Action は 1 回の実行で 1 ラウンドの修正のみ行う。複数ラウンドの修正は Code Rabbit の再レビュー -> 再トリガーで実現する
- 修正ごとにワークフローが別ジョブとして起動するため、前回の修正コンテキストは引き継がれない
- Code Rabbit が再レビューしない設定の場合、ループが成立しない
- `pull_request_review` イベントはベースブランチのワークフローを参照する。ワークフロー修正はベースブランチにマージしないと反映されない

## Future: pr-autoland Integration

将来的には [ai-autoland](https://github.com/abc1nc/ai-autoland) をフォークした **pr-autoland** で以下を実現する。

### pr-autoland が解決する課題

| 課題 | 現行 (Claude Code Action 単体) | pr-autoland |
|------|-------------------------------|-------------|
| ループ制御 | GitHub Actions イベント再発火（暗黙的） | 内部ループ（明示的、CI 待ち含む） |
| コンテキスト | 修正ごとにリセット | 1 セッション内で保持 |
| マージ自動化 | GitHub Auto-merge に依存 | 組み込み |
| 状態管理 | PR body メタ情報（自前実装） | 内部管理 |
| デバッグ | GitHub Actions ログ | `autoland debug <PR>` コマンド |

### pr-autoland の主要要件

- **`--pr NUMBER` オプション**: 特定の PR を指定して処理（フォーク元にはない機能）
- **`--agent claude` 対応**: claude CLI をサブプロセスで呼び出し（フォーク元の既存機能）
- **内部ループ**: 修正 -> CI 待ち -> 再チェック -> 修正不要ならマージ（フォーク元の既存機能）
- **AUTOLAND.md**: プロジェクト固有の AI エージェント向け指示（フォーク元の既存機能）

### 移行イメージ

現行の GitHub Actions ワークフローを差し替えるだけで移行可能。

```yaml
# 移行後のワークフロー
steps:
  - uses: actions/setup-python@v5
    with:
      python-version: "3.13"
  - run: pipx install git+https://github.com/<org>/pr-autoland.git
  - run: npm install -g @anthropic-ai/claude-code
  - run: autoland --agent claude --pr ${{ github.event.pull_request.number }}
    env:
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```
