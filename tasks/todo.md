# Task 1: ローカルサーバーのセットアップ

## Plan
- [x] pnpm workspace の設定 (pnpm-workspace.yaml)
- [x] ルート package.json の更新 (private, scripts, devDependencies)
- [x] tsconfig.base.json の作成
- [x] packages/shared の型定義作成 (BookData, RegistrationResponse 等)
- [x] packages/server の作成 (Express, dotenv, cors, @notionhq/client)
- [x] .env.example の作成
- [x] .gitignore の更新 (.env, dist/ 追加)
- [x] ESLint / Prettier の基本設定
- [x] テスト基盤の作成 (vitest.config.ts)
- [x] 依存関係のインストールと動作確認

## Review
- pnpm install: OK
- pnpm typecheck: OK (shared, server 両方パス)
- サーバー起動: OK (http://127.0.0.1:3000 でリッスン確認)
- .env が .gitignore に含まれている: OK
- shared の型が server から import 可能: OK

---

# Task 2: Notion API連携の実装

## Plan
- [x] 2.3 NotionClient ユニットテストを先行作成（RED）
- [x] 2.1 NotionClient クラスの実装（GREEN）
- [x] 2.2 Property 14 プロパティテストの作成
- [x] リファクタリングと品質確認（REFACTOR）

## Review
- lint: 0 errors, 0 warnings
- type-check: Success (shared, server)
- テスト: 26 passed (unit 16, property 10)
- カバレッジ: notion-client.ts 100%/100%/100%/100%, 全体 85%+
- ビルド: Build successful
