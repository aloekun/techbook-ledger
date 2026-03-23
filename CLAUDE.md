# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

techbook-ledger は技術書の購買意思決定を支援するシステム。Chrome 拡張機能が書籍販売サイトから JSON-LD を解析し、ローカル Express サーバー経由で Notion Database に書籍情報を登録する 3 層アーキテクチャ。

```
Browser (Content Script) -> Chrome Extension (Popup/SW) -> Express API (localhost:3000) -> Notion API
```

## コマンド

```bash
# 依存関係インストール
pnpm install

# 全パッケージ一括
pnpm test              # 全テスト実行
pnpm lint              # ESLint
pnpm lint:fix          # ESLint 自動修正
pnpm typecheck         # 型チェック
pnpm build             # ビルド

# 単一パッケージ指定（shared / server / extension）
pnpm run test:f shared
pnpm run typecheck:f server
pnpm run build:f shared

# カバレッジ付きテスト
pnpm run test:coverage:f server

# 開発サーバー
pnpm run dev:f server

# 単一テストファイル実行
pnpm run test:file server tests/unit/notion-client.test.ts
```

**注意**: フィルタスクリプト (`test:f`, `typecheck:f` 等) は `bash -c` + 位置パラメータで実装されている。`--` は付けずに呼び出す。

## モノレポ構造

pnpm workspace による 3 パッケージ構成:

| パッケージ | 役割 | 主要技術 |
|-----------|------|---------|
| `packages/shared` | 型定義と共有ユーティリティ | TypeScript |
| `packages/server` | Express API サーバー (Notion 連携) | Express, @notionhq/client, dotenv |
| `packages/extension` | Chrome Manifest v3 拡張機能 | Vite + CRXJS |

`@techbook-ledger/shared` は server/extension から `workspace:*` で参照される。共通 devDeps (vitest, typescript, eslint 等) はルートに配置。

詳細は [ai/rules/PROJECT_ARCHITECTURE.md](ai/rules/PROJECT_ARCHITECTURE.md) を参照。

## アーキテクチャ上の注意点

- Notion API トークンはサーバー側の `.env` にのみ保存。ブラウザには一切露出しない
- サーバーは `127.0.0.1` のみでリッスン。CORS は拡張機能オリジンのみ許可
- ISBN をユニークキーとして重複登録を防止
- `packages/server/src/config/env.ts` は `import.meta.url` 基準でルートの `.env` を参照 (4 階層上)
- Notion プロパティ名は日本語 (`タイトル`, `著者`, `出版社` 等)。`buildNotionProperties()` でマッピング
- API エラーは `NotionAuthError` / `NotionRateLimitError` / `NotionConnectionError` に分類。レート制限時は指数バックオフで最大 3 回リトライ

## テスト

- Vitest + fast-check (property-based testing)
- テストは `packages/*/tests/` 配下に `unit/`, `property/`, `integration/` で分類
- `vitest.config.ts` で `globals: true` (import 不要)
- カバレッジ閾値 80% (server パッケージで設定済み)
- Property tests は `docs/design.md` の Correctness Properties (Property 1-20) に対応

詳細は [ai/rules/TESTING_STRATEGY.md](ai/rules/TESTING_STRATEGY.md) を参照。

## バージョン管理 (Jujutsu)

**`git` コマンドは `.claude/hooks-pre-tool-validate.exe` フックによりブロックされる。** 代わりに `jj` を使用する。

```bash
jj status                              # 状態確認
jj diff                                # 差分
jj log                                 # 履歴
jj new develop                         # develop の上に新しい変更を作成（作業開始時に必須）
jj describe -m "feat(scope): message"  # 変更を記述
jj bookmark create feature/N-desc      # ブックマーク作成 (describe 後に実行)
jj git push --bookmark name            # push (初回は --allow-new 追加)
jj git fetch                           # fetch
gh pr create --base develop ...        # PR 作成 (gh CLI 使用)
```

**注意**: 作業開始時は必ず `jj new develop` で空の変更を作成してから作業する。develop ブックマーク上で直接作業するとブックマーク競合の原因になる。

詳細は [ai/rules/VCS_JUJUTSU.md](ai/rules/VCS_JUJUTSU.md) を参照。

## ブランチ・コミット規約

- ブランチ: `develop` から切る。命名: `<type>/<issue番号>-<kebab-case>`
- コミット: Conventional Commits (`feat`, `fix`, `refactor`, `docs`, `test`, `chore`)
- PR は `develop` に向けて作成。詳細は [ai/rules/GIT_WORKFLOW.md](ai/rules/GIT_WORKFLOW.md) を参照

---

## ワークフロー

### 1. 計画フェーズ（プランモード）
- 3ステップ以上 または 設計判断が必要なタスクは **必ずプランモードに入る**
- 途中で問題が発生したら **即座に作業を止めて再計画する**（無理に進めない）
- 構築だけでなく、検証ステップもプランモードで計画する
- 詳細な仕様をあらかじめ明文化して曖昧さを排除する

### 2. サブエージェント戦略
- メインのコンテキストウィンドウをクリーンに保つために **サブエージェントを積極活用する**
- リサーチ・コード探索・並列分析はサブエージェントに委譲する
- 複雑な問題には複数のサブエージェントを投入してより多くの計算リソースをかける
- 1サブエージェント = 1タスクで集中して実行させる

### 3. 自己改善ループ
- ユーザーから修正指摘を受けたら **必ず `tasks/lessons.md` にそのパターンを記録する**
- 同じミスを繰り返さないためのルールを自分向けに書く
- ミス率が下がるまでレッスンを徹底的に改善し続ける
- セッション開始時にそのプロジェクトに関連するレッスンをレビューする

### 4. 完了前の検証（必須）
- **動作を証明せずにタスク完了としない**
- 関連する場合は `main` と自分の変更の差分を確認する
- 「スタッフエンジニアがこれを承認するか？」と自問する
- テストを実行し、ログを確認し、正しさを実証する

### 5. エレガントさを追求する（バランス重視）
- 非自明な変更では「より優雅な方法はないか？」と立ち止まって考える
- 修正がハック的に感じたら：「今知っている全てを活かして、エレガントな解決策を実装する」
- 単純で明白な修正にはこれを省略する（過剰設計しない）
- 提示する前に自分のコードを批判的にレビューする

### 6. バグ修正の自律対応
- バグレポートが来たら **そのまま修正する**（手取り足取り聞かない）
- ログ・エラー・失敗テストを手がかりにして自力で解決する
- ユーザーのコンテキストスイッチをゼロにする
- 指示されなくても CI の失敗テストを修正しに行く

### 7. タスク完了フロー
品質チェック（テスト・lint・typecheck）が全てパスしたら、以下を **ユーザーの指示を待たずに** 実行する:
1. `tasks/todo.md` にレビューセクションを記録する
2. `jj new` で新しい変更を作成し、コミット・プッシュする
3. PR を作成する（`gh pr create --base develop`）
4. PR URL をユーザーに報告する

---

## タスク管理

進捗は **2箇所** で追跡する。

| 管理先 | 用途 | 更新タイミング |
|--------|------|---------------|
| **TodoWrite ツール** | Claude Code セッション内のリアルタイム進捗表示 | タスク着手時・完了時に即座に更新 |
| **`tasks/todo.md`** | セッションをまたいで残る永続的な記録 | 各ステップ完了時にチェック済みにする |

| ステップ | 内容 |
|----------|------|
| **計画を立てる** | `tasks/todo.md` にチェック可能な項目でプランを書き、TodoWrite にも同期する |
| **計画を確認する** | 実装開始前にチェックインする |
| **進捗を追跡する** | TodoWrite で即時更新し、`tasks/todo.md` のチェックボックスも完了時に更新する |
| **変更を説明する** | 各ステップでハイレベルなサマリーを提示する |
| **結果を記録する** | `tasks/todo.md` にレビューセクションを追加する |
| **レッスンを残す** | 修正指摘を受けたら `tasks/lessons.md` を更新する |
| **コミット・PR** | 品質チェック通過後、コミット・プッシュ・PR 作成まで一気に実施する |

---

## 基本原則

**シンプルさを最優先**: あらゆる変更を可能な限りシンプルにする。影響するコードを最小限に留める。
**手を抜かない**: 根本原因を突き止める。一時しのぎの修正はしない。シニアエンジニアの水準で臨む。
**影響を最小化する**: 変更は必要な箇所だけに留める。バグを新たに持ち込まない。

## 詳細ルール参照

| ルールファイル | 内容 |
|--------------|------|
| [ai/rules/PROJECT_ARCHITECTURE.md](ai/rules/PROJECT_ARCHITECTURE.md) | ディレクトリ構成・データモデル・API 仕様・Notion スキーマ |
| [ai/rules/VCS_JUJUTSU.md](ai/rules/VCS_JUJUTSU.md) | jj の操作・ブックマークワークフロー |
| [ai/rules/GIT_WORKFLOW.md](ai/rules/GIT_WORKFLOW.md) | ブランチ命名・コミット規約・PR テンプレート |
| [ai/rules/TESTING_STRATEGY.md](ai/rules/TESTING_STRATEGY.md) | TDD・テストピラミッド・Property-Based Testing |
| [ai/rules/QUALITY_CHECK.md](ai/rules/QUALITY_CHECK.md) | タスク完了前の品質チェック項目と報告フォーマット |
| [ai/rules/GITHUB_PR_REVIEW.md](ai/rules/GITHUB_PR_REVIEW.md) | PR レビューコメントの `--jq` フィルタパターン |
