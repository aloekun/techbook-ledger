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

---

# Task 7: Chrome拡張機能の基本構造

## Plan
- [x] 7.1 プロジェクト構造の作成 (package.json, tsconfig, vite, vitest, manifest.json)
- [x] 7.1 ディレクトリ構造の作成 (popup, content, background, settings, storage)
- [x] 7.1 依存関係のインストール (@crxjs/vite-plugin, @types/chrome, vite)
- [x] 7.2 Extension Storage ユニットテスト作成 (tests/unit/storage-config.test.ts) - RED
- [x] 7.2 Extension Storage 実装 (src/storage/config.ts) - GREEN
- [x] 7.3 Property 20: 設定の永続化ラウンドトリップ (tests/property/storage-config.test.ts)
- [x] shared vitest.config.ts に passWithNoTests 追加
- [x] 品質確認 (lint, typecheck, test, build, coverage)

## Review

| チェック | 結果 |
|---------|------|
| lint | 0 errors, 0 warnings |
| type-check | Success (shared, server, extension) |
| テスト | 100 passed (server 84 + extension 16) |
| カバレッジ | config.ts 100%/100%/100%/100% |
| ビルド | vite build successful (dist/ 生成確認) |

## PR #11 レビュー対応

- [x] CodeRabbit: passWithNoTests: true 削除 (packages/shared/vitest.config.ts)
- [x] shared の test スクリプトを tsc --noEmit に変更 (型のみパッケージのため)
- [x] 7.4 shared パッケージの typecheck 修正

---

# Task 7.4: shared パッケージの typecheck 修正

## Plan
- [x] tsconfig.json に emitDeclarationOnly: true を追加
- [x] package.json の exports から import (JS) を削除し types のみに
- [x] export type を export { type ... } に変更 (.d.ts 出力のため)
- [x] 品質確認 (lint, typecheck, test, build)

## Review

| チェック | 結果 |
|---------|------|
| lint | 0 errors, 0 warnings |
| type-check | Success (shared, server, extension) |
| テスト | 106 passed (server 84 + extension 22) |
| ビルド | shared dist/ 生成確認 (.d.ts x2) |

---

# Task 5.6: 重複チェックのアトミック化

## Plan
- [x] isbn-lock.ts の TDD (RED → GREEN)
- [x] RegisterResult 型を shared に追加
- [x] NotionBookClient.registerIfAbsent() の TDD (RED → GREEN)
- [x] BookService インターフェースを registerIfAbsent に変更
- [x] ルートハンドラを registerIfAbsent に切り替え
- [x] books-route テスト・property テストを更新
- [x] 品質確認 (lint, typecheck, test, coverage)

## Review

| チェック | 結果 |
|---------|------|
| lint | 0 errors, 0 warnings |
| type-check | Success (shared, server) |
| テスト | 116 passed (10 suites) |
| カバレッジ | 87.76% (閾値 80% クリア) |

---

# Task 6: Checkpoint - ローカルサーバーの動作確認

## 確認項目

- [x] 全テスト通過: 138 passed (server 116 + extension 22)
- [x] lint: 0 errors, 0 warnings
- [x] typecheck: Success (shared, server, extension)
- [x] サーバー起動: http://127.0.0.1:3201 でリッスン確認
- [x] GET /health: `{"status":"ok"}`
- [x] POST /api/books (正常登録): 201, `{"success":true,"message":"書籍を登録しました","notionUrl":"..."}`
- [x] POST /api/books (重複検出): 200, `{"success":false,"message":"この書籍は既に登録されています","isDuplicate":true}`
- [x] POST /api/books (バリデーションエラー): 400, 欠落フィールド一覧を返却

## Review

| チェック | 結果 |
|---------|------|
| テスト | 138 passed (server 116, extension 22) |
| lint | 0 errors, 0 warnings |
| typecheck | Success (shared, server, extension) |
| ヘルスチェック | GET /health -> 200 OK |
| 正常登録 | POST /api/books -> 201 Created, Notion にページ作成確認 |
| 重複検出 | 同一 ISBN 再送信 -> 200, isDuplicate: true |
| バリデーション | 必須フィールド欠落 -> 400, 欠落フィールド名を返却 |

---

# Task 8: ホワイトリスト機能の実装

## Plan

- [x] 8.1 ホワイトリストマッチングの実装
  - `matchesWhitelistPattern()` 関数: 単一パターンとホスト名のマッチング
  - `isWhitelistedSite()` 関数: ホワイトリスト全体との照合
  - ワイルドカードパターンマッチング (`*.domain`)
  - デフォルトホワイトリスト（amazon.co.jp, gihyo.jp, *.amazon.co.jp）
  - Requirements: 2.1, 2.2, 2.3, 2.4

- [x] 8.2 Property 5: ホワイトリスト外サイトの機能無効化
  - ホワイトリスト外ドメインで `isWhitelistedSite()` が false を返す
  - 空のホワイトリストですべてのドメインが false を返す
  - Validates: Requirements 2.2

- [x] 8.3 Property 6: ホワイトリスト内サイトのUI表示
  - デフォルトホワイトリスト内ドメインで true を返す
  - カスタムホワイトリストの完全一致で true を返す
  - Validates: Requirements 2.3

- [x] 8.4 Property 7: ワイルドカードドメインマッチング
  - `*.domain` パターンが `sub.domain` にマッチ
  - `*.domain` パターンが `domain` 自体にはマッチしない
  - 完全一致パターンが正確に動作する
  - Validates: Requirements 2.4

## Review

| チェック | 結果 |
|---------|------|
| lint | Error 0, Warning 0 |
| type-check | Success (shared + extension) |
| テスト | 34 passed (9 property + 25 unit), Coverage 100% |
| ビルド | Build successful |
