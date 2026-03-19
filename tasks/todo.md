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

---

# Task 9: JSON-LD解析の実装

## Plan

### Phase 1: Infrastructure
- [x] pnpm-workspace.yaml, tsconfig.base.json, root package.json 更新
- [x] packages/shared: BookData 型定義 + ISBN正規化ユーティリティ (TDD)
- [x] packages/extension: パッケージ基盤 (package.json, tsconfig, vitest.config)

### Phase 2: Implementation (TDD - Red → Green → Refactor)
- [x] extractJsonLd() - JSON-LDブロック抽出関数
- [x] findBookData() - Book型オブジェクト検索・抽出関数
- [x] ISBN正規化処理
- [x] 必須フィールド検証

### Phase 3: Property Tests
- [x] Property 1: JSON-LD解析の完全性 (Req 1.2)
- [x] Property 2: ISBN正規化の一貫性 (Req 1.4)
- [x] Property 3: ISBN欠落時の登録拒否 (Req 1.3)
- [x] Property 4: 複数JSON-LDブロックの処理 (Req 1.5)

### Phase 4: Quality & Delivery
- [x] lint / typecheck / test / build すべてパス
- [x] コミット・プッシュ・PR作成

## Review

| チェック | 結果 |
|---------|------|
| lint | 0 errors, 0 warnings |
| typecheck | Success (shared, server, extension) |
| テスト | 215 passed (shared 14 + server 116 + extension 85) |
| カバレッジ | 80%+ (閾値クリア) |

## Notes
- TDD: テストファースト、Red→Green→Refactor
- fast-check: 各プロパティ100回以上の反復
- カバレッジ: 80%以上

---

# Task 10: Popup UIの実装

## Plan
- [x] 10.1 Popup HTML/CSS の作成
  - status div にクラス追加、360px 幅ポップアップスタイリング
  - settings.css と統一デザイン (色、フォント、ボーダー半径)
  - 5 状態のステータス表示 (inactive/ready/loading/success/error)
  - Requirements: 9.1, 9.2, 9.3, 9.5

- [x] 10.2 Popup ロジックの実装
  - popup-state.ts: 純粋関数 (状態導出、formatPrice、formatBookInfoHtml)
  - messages.ts: メッセージプロトコル型定義 (GET_BOOK_DATA, REGISTER_BOOK)
  - popup.ts: initPopup(deps?) + renderState + autoInit
  - 依存注入パターンで getBookData/registerBook/scheduleReset を差し替え可能
  - 3秒間の結果表示とリセット (scheduleReset 注入でテスト容易)
  - Requirements: 3.1, 3.6, 3.7, 9.1, 9.3, 9.4, 9.5

- [x] 10.3 Popup UI のユニットテスト
  - popup-state.test.ts: 23 テスト (純粋関数のテスト)
  - popup.test.ts: 16 テスト (DOM 統合テスト)
  - TDD: RED -> GREEN -> REFACTOR サイクル
  - Requirements: 9.1, 9.2, 9.3, 9.4

## Review

| チェック | 結果 |
|---------|------|
| lint | 0 errors, 0 warnings |
| type-check | Success (shared, server, extension) |
| テスト | 276 passed (extension 160, server 116) |
| カバレッジ | 89% stmts / 92.51% branch / 92.1% funcs / 89% lines |
| ビルド | Build successful (shared, server, extension) |

---

# Task 12: Settings Pageの実装

## Plan
- [x] 12.3 Property 19: エンドポイント形式検証テストの作成 (tests/property/settings.test.ts) - RED
- [x] 12.1/12.2 ユニットテスト作成 (tests/unit/settings.test.ts) - RED
  - validateEndpoint() のバリデーション検証
  - Settings ページ初期化・フォーム操作・保存フロー検証
- [x] 12.2 validateEndpoint() 実装 (src/settings/settings.ts) - GREEN
  - localhost / 127.0.0.1 の HTTP URL のみ受け入れ
  - パス・クエリ・フラグメント・不正ポートの拒否
- [x] 12.2 initSettings() 実装 (src/settings/settings.ts) - GREEN
  - Extension Storage から設定読込・フォーム反映
  - submit ハンドラでバリデーション → 保存 → メッセージ表示
  - 空行・空白のトリム、設定の即時反映
- [x] 12.1 Settings UI の作成 (index.html, settings.css)
  - エンドポイント入力、ホワイトリスト編集、保存ボタン
  - ヒントテキスト、成功/エラーメッセージスタイル
- [x] 品質確認 (lint, typecheck, test, coverage, build)
- [ ] E2E テスト (deferred: Playwright 基盤構築後に実施)

## Review

| チェック | 結果 |
|---------|------|
| lint | 0 errors, 0 warnings |
| type-check | Success (shared, server, extension) |
| テスト | 170 passed (extension 54, server 116) |
| カバレッジ | settings.ts 94.59%/84.37%/100%/94.59%, 全体 96.22% |
| ビルド | Build successful (shared, server, extension) |

---

# Task 11: Service Workerの実装

## Plan
- [x] 11.2 Service Worker ユニットテスト作成 (tests/unit/service-worker.test.ts) - RED
  - registerBook(): 成功/重複/400/429/500/503/ネットワークエラー/非JSONレスポンス
  - parseRegistrationResponse(): 有効レスポンス/オプショナルフィールド/不正データ
  - isRegisterBookMessage(): 有効/無効メッセージ判定
  - setupMessageListener(): リスナー登録/REGISTER_BOOK処理/無関係メッセージ無視/エラー処理
- [x] 11.1 Service Worker ロジックの実装 (src/background/service-worker.ts) - GREEN
  - registerBook(): Extension StorageからserverEndpoint取得、fetch POST、レスポンス解析
  - parseRegistrationResponse(): 防御的パース (unknown -> RegistrationResponse)
  - isRegisterBookMessage(): 型ガード
  - setupMessageListener(): chrome.runtime.onMessage リスナー登録
  - DI パターン (ServiceWorkerDeps) でテスタビリティ確保
- [x] 品質確認 (lint, typecheck, test, coverage, build)

## Review

| チェック | 結果 |
|---------|------|
| lint | 0 errors, 0 warnings |
| type-check | Success (shared, server, extension) |
| テスト | 198 passed (extension 82 (32 new), server 116) |
| カバレッジ | service-worker.ts 95.4%/93.33%/100%/95.4%, 全体 90.16% |
| ビルド | Build successful (shared, server, extension) |

---

# Task 13: エラーハンドリングの統合

## Plan
- [x] 13.1 Extension側エラーメッセージの実装
  - error-messages.ts: identifyMissingFields, formatMissingFieldsMessage (TDD)
  - popup-state.ts: derivePopupState で欠落フィールド検出 + error 状態返却
  - popup.ts: retry-btn 制御、retryable 状態対応
  - popup.html: retry-btn 追加
  - popup.css: retry-btn スタイル
  - Requirements: 7.1, 7.2, 7.4, 7.5
- [x] 13.2 Property 18: 欠落フィールドの特定テスト
  - fast-check で任意の BookData + 欠落マスクを生成
  - identifyMissingFields が正確に欠落フィールドを検出することを検証
  - 100 回以上の反復、4 テストケース
- [x] 13.3 エラーハンドリングのユニットテスト
  - error-messages.test.ts: 20 テスト (identifyMissingFields, formatMissingFieldsMessage)
  - popup-state.test.ts: 4 テスト追加 (欠落フィールド検出)
  - popup.test.ts: 10 テスト追加 (欠落フィールド表示、再試行ボタン、エラーメッセージ統合)
  - Requirements: 7.1, 7.2, 7.4, 7.5

## Review

| チェック | 結果 |
|---------|------|
| lint | 0 errors, 0 warnings |
| type-check | Success (shared, server, extension) |
| テスト | 237 passed (extension 121 (39 new), server 116) |
| カバレッジ | 91.13% stmts / 93.19% branch / 93.33% funcs / 91.13% lines |
| error-messages.ts | 100%/100%/100%/100% |
| popup-state.ts | 100%/100%/100%/100% |
| ビルド | Build successful (shared, server, extension) |

---

# Task 14: Checkpoint - コンポーネント統合前の確認

## 確認項目

- [x] 全テスト通過: 372 passed (shared 14 + server 120 + extension 238)
- [x] lint: 0 errors, 0 warnings
- [x] typecheck: Success (shared, server, extension)
- [x] カバレッジ: server 87.76%, extension 91.13% (閾値 80% クリア)
- [x] ビルド: Build successful (shared, server, extension)
- [x] Property テスト 20/20 完備 (Property 15 を本タスクで追加)

## 各コンポーネントの独立動作確認

### packages/shared (型定義 + ISBN ユーティリティ)
- 14 tests passed (unit 9 + property 5)
- `normalizeIsbn()`, `removeHyphens()` 正常動作
- server / extension から正しく型参照可能

### packages/server (Express API サーバー)
- 120 tests passed (unit 87 + property 33)
- カバレッジ: 87.76% stmts / 96.8% branch / 95.45% funcs
- Notion API エラー分類 (Auth/RateLimit/Connection) 正常動作
- ISBN ロック (アトミック重複チェック) 正常動作
- リクエストバリデーション正常動作
- Property 10-15, 16-17 全てパス

### packages/extension (Chrome Manifest v3 拡張機能)
- 238 tests passed (unit 211 + property 27)
- カバレッジ: 91.13% stmts / 93.19% branch / 93.33% funcs
- JSON-LD パーサー正常動作 (Property 1-4)
- ホワイトリスト正常動作 (Property 5-7)
- Popup UI 正常動作 (状態管理 + レンダリング)
- Service Worker 正常動作 (fetch + メッセージリスナー)
- Settings ページ正常動作 (Property 19)
- Extension Storage 正常動作 (Property 20)
- エラーメッセージ正常動作 (Property 18)

### カバレッジ低ファイルの分析

| ファイル | カバレッジ | 理由 |
|---------|----------|------|
| content/index.ts | 0% | プレースホルダ (Task 15 で実装予定) |
| popup/messages.ts | 0% | 型定義のみ、ランタイムコードなし |
| popup/popup.ts | 78.2% | autoInit + Chrome API デフォルト実装 (DI で代替テスト済み) |
| settings/settings.ts | 87.64% | autoInit 部分のみ未カバー |

### 追加実施: Property 15 (Notion API エラー変換)

設計書の 20 Property テストを照合した結果、Property 15 が未実装だったため TDD で追加。
- NotionAuthError -> 500 変換テスト (100 runs)
- NotionRateLimitError -> 429 変換テスト (100 runs)
- NotionConnectionError -> 503 変換テスト (100 runs)
- 予期しないエラー -> 500 (raw message 非露出) テスト (100 runs)

## Review

### 定量品質確認フォーマット

| チェック | 結果 |
|---------|------|
| lint | 0 errors, 0 warnings |
| type-check | Success (shared, server, extension) |
| テスト | 372 passed (shared 14, server 120, extension 238) |
| カバレッジ | server 87.76%, extension 91.13% |
| ビルド | Build successful (shared, server, extension) |

---

# Task 15: システム統合

## Plan
- [x] 15.1 End-to-Endフローの配線
  - Content Script (`content/index.ts`) の実装: JSON-LD 解析 + GET_BOOK_DATA メッセージリスナー
  - Content Script → Popup → Service Worker → Local Server → Notion API の全フロー接続
  - レスポンスの逆方向フロー (Server → Service Worker → Popup → UI)
  - TDD: RED → GREEN → REFACTOR サイクル
  - Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7

- [x] 15.2 統合テスト
  - サーバー統合テスト (packages/server/tests/integration/registration-flow.test.ts)
    - 正常登録フロー (Req 3.1, 3.4, 3.5, 3.6): 4 テスト
    - 重複検出フロー (Req 3.2, 3.3): 3 テスト
    - バリデーションエラーフロー (Req 4.3): 4 テスト
    - Notion APIエラーフロー: 4 テスト
    - CORSセキュリティ (Req 4.2, 8.3): 2 テスト
    - ヘルスチェック: 1 テスト
  - Extension統合テスト (packages/extension/tests/integration/e2e-flow.test.ts)
    - 正常登録フロー (Req 3.1, 3.4, 3.6): 2 テスト
    - 重複検出フロー (Req 3.2, 3.3): 1 テスト
    - エラーケース (Req 3.7, 7.1, 7.2, 7.4, 7.5): 6 テスト
    - データフロー検証: 3 テスト
  - Content Script ユニットテスト (packages/extension/tests/unit/content-script.test.ts)
    - setupContentScript: 1 テスト
    - handleGetBookData: 6 テスト
    - メッセージリスナー動作: 4 テスト

## Review

### 定量品質確認フォーマット

| チェック | 結果 |
|---------|------|
| lint | ✅ 0 errors, 0 warnings |
| type-check | ✅ Success (shared, server, extension) |
| テスト | ✅ 414 passed (shared 14, server 138, extension 262) |
| E2Eテスト | N/A - `pnpm e2e` コマンドは未設定 |
| カバレッジ | ✅ server 87.76%, extension 91.52% (閾値 80% クリア) |
| ビルド | ✅ Build successful (shared, server, extension) |

### 新規作成ファイル
- `packages/extension/src/content/index.ts` - Content Script 実装 (E2Eフロー配線)
- `packages/extension/tests/unit/content-script.test.ts` - Content Script ユニットテスト (11件)
- `packages/server/tests/integration/registration-flow.test.ts` - サーバー統合テスト (18件)
- `packages/extension/tests/integration/e2e-flow.test.ts` - Extension統合テスト (13件)

### テスト増分
- 新規テスト: 42件 (content-script 11 + server integration 18 + extension integration 13)
- 合計: 414 passed (前回 372 → 414, +42)

---

# Task 16: 最終チェックポイント

## Plan
- [x] 全品質チェック実行 (lint, typecheck, test, coverage, build)
- [x] README.md の作成
  - プロジェクト概要・アーキテクチャ図
  - 前提条件
  - セットアップ手順 (Notion Integration 作成、Database 作成、環境変数設定、ビルド、サーバー起動、拡張機能インストール)
  - 使い方 (書籍登録フロー、設定変更)
  - 対応サイト一覧
  - 開発者向け情報 (ディレクトリ構成、コマンド、テスト、API エンドポイント)
  - 手動テスト手順 (5 シナリオ)
  - セキュリティ設計
- [x] 手動テスト手順の文書化 (README.md 内に記載)
- [x] docs/tasks.md の Task 16 を完了済みに更新

## Review

### 定量品質確認フォーマット

| チェック | 結果 |
|---------|------|
| lint | ✅ 0 errors, 0 warnings |
| type-check | ✅ Success (shared, server, extension) |
| テスト | ✅ 416 passed (shared 14, server 140, extension 262) |
| カバレッジ | ✅ server 88.22%, extension 91.52% (閾値 80% クリア) |
| ビルド | ✅ Build successful (shared, server, extension) |

### 新規作成ファイル
- `README.md` - プロジェクト README (セットアップ手順、使用方法、アーキテクチャ、API 仕様、手動テスト手順、セキュリティ)

### テスト増分
- テスト数変化: 414 → 416 (+2, server 138→140)
- 全 20 Property テスト完備

### 全タスク完了状況
- Task 1-16: 全て完了
- Property 1-20: 全て実装・通過
- テスト総数: 416 (shared 14, server 140, extension 262)
- カバレッジ: server 88.22%, extension 91.52%

---

# Task 17: Auto Review Fix ワークフロー

> **別プロジェクトに移行済み。** このリポジトリからは関連ファイル（ワークフロー・仕様ドキュメント・ループカウントロジック・テスト）を削除。
