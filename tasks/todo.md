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

---

# Task 3: 重複チェックロジックの実装

## Plan
- [x] 3.1 ユニットテスト作成 (tests/unit/duplicate-checker.test.ts) - RED
- [x] 3.1 checkDuplicate() 実装 (src/services/duplicate-checker.ts) - GREEN
- [x] 3.2 Property 8: 重複チェックの実行
- [x] 3.3 Property 9: 重複時の登録拒否
- [x] 3.4 Property 16: ISBN大文字小文字の同一視
- [x] 3.5 Property 17: 重複検出時のURL返却
- [x] 品質確認 (test, typecheck, lint, coverage)

## Review
- lint: 0 errors, 0 warnings
- type-check: Success (shared, server)
- テスト: 41 passed (unit 24, property 17)
- カバレッジ: duplicate-checker.ts 100%/100%/100%/100%, services 全体 100%
- 全体カバレッジ: 87%+ (閾値 80% クリア)

---

# Task 4: リクエスト検証の実装

## Plan
- [x] 4.1 ユニットテスト作成 (tests/unit/request-validator.test.ts) - RED
- [x] 4.1 validateBookRecord() 実装 (src/middleware/validator.ts) - GREEN
- [x] 4.2 Property 12: リクエスト検証の完全性
- [x] 品質確認 (test, typecheck, lint, coverage)

## Review
- lint: 0 errors, 0 warnings
- type-check: Success (server)
- テスト: 80 passed (unit 33 + property 6 = 新規 39)
- カバレッジ: validator.ts 100%/100%/100%/100%, 全体 89%+
