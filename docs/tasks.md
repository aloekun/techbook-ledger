# Implementation Plan: techbook-ledger

## Overview

本実装計画は、Chrome拡張機能、Node.jsローカルサーバー、Notion API連携の3つのコンポーネントを段階的に構築します。各ステップは前のステップの成果物を基盤とし、最終的にすべてのコンポーネントを統合します。

実装は以下の順序で進めます：
1. ローカルサーバーの基盤構築（Notion連携含む）
2. Chrome拡張機能の基本構造
3. JSON-LD解析とデータ抽出
4. 統合とエラーハンドリング

## Tasks

- [x] 1. ローカルサーバーのセットアップ
  - Node.jsプロジェクトの初期化（package.json作成）
  - 必要な依存関係のインストール（express, @notionhq/client, dotenv, cors）
  - .envファイルテンプレート作成（NOTION_TOKEN, NOTION_DATABASE_ID）
  - .gitignoreに.envを追加
  - _Requirements: 4.4, 5.1, 8.2_

- [x] 2. Notion API連携の実装
  - [x] 2.1 NotionClientクラスの実装
    - 環境変数から認証情報を読み込むコンストラクタ
    - queryByIsbn()メソッド: ISBNでデータベース検索
    - createBookRecord()メソッド: 新規ページ作成
    - エラーハンドリングとレート制限対応
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 2.2 NotionClientのプロパティテスト
    - **Property 14: Book_RecordからNotionプロパティへのマッピング**
    - **Validates: Requirements 5.2, 5.3**

  - [x] 2.3 NotionClientのユニットテスト
    - 環境変数読込のテスト
    - Notion APIエラー処理のテスト（モック使用）
    - レート制限処理のテスト
    - _Requirements: 5.1, 5.4, 5.5_

- [x] 3. 重複チェックロジックの実装
  - [x] 3.1 Duplicate Checkerの実装
    - checkDuplicate()関数: ISBN正規化と検索
    - 大文字小文字を区別しない比較
    - 既存レコードのURL取得
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 3.2 重複チェックのプロパティテスト
    - **Property 8: 重複チェックの実行**
    - **Validates: Requirements 3.2**

  - [x] 3.3 重複チェックのプロパティテスト
    - **Property 9: 重複時の登録拒否**
    - **Validates: Requirements 3.3**

  - [x] 3.4 重複チェックのプロパティテスト
    - **Property 16: ISBN大文字小文字の同一視**
    - **Validates: Requirements 6.2**

  - [x] 3.5 重複チェックのプロパティテスト
    - **Property 17: 重複検出時のURL返却**
    - **Validates: Requirements 6.3**

- [x] 4. リクエスト検証の実装
  - [x] 4.1 Request Validatorの実装
    - validateBookRecord()関数: 必須フィールド検証
    - データ型検証
    - ISBNフォーマット検証（10桁または13桁の数字）
    - _Requirements: 4.3_

  - [x] 4.2 リクエスト検証のプロパティテスト
    - **Property 12: リクエスト検証の完全性**
    - **Validates: Requirements 4.3**

- [x] 5. Express APIサーバーの実装
  - [x] 5.1 APIエンドポイントの実装
    - POST /api/books エンドポイント
    - CORS設定（localhost拡張機能からのリクエスト許可）
    - localhostのみでリッスン
    - リクエスト検証 → 重複チェック → Notion登録のフロー
    - エラーレスポンスの統一フォーマット
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.5, 4.6_
  
  - [x] 5.2 APIエンドポイントのプロパティテスト
    - **Property 10: 新規レコードの作成**
    - **Validates: Requirements 3.4**

  - [x] 5.3 APIエンドポイントのプロパティテスト
    - **Property 11: タイムスタンプの自動付与**
    - **Validates: Requirements 3.5**

  - [x] 5.4 APIエンドポイントのプロパティテスト
    - **Property 13: 認証情報の非露出**
    - **Validates: Requirements 4.5**

  - [x] 5.5 APIエンドポイントのユニットテスト
    - CORS設定の確認
    - 各種エラーケースのレスポンス検証
    - _Requirements: 4.2, 4.6, 7.3_

  - [x] 5.6 重複チェックのアトミック化
    - checkDuplicate → createBookRecord の非アトミック問題を解消
    - 同一ISBNの並行リクエストで二重登録が発生しうる
    - BookService に registerIfAbsent() 的なアトミック操作を導入検討
    - _Requirements: 6.1_

- [x] 6. Checkpoint - ローカルサーバーの動作確認
  - すべてのテストが通ることを確認
  - 手動でcurlコマンドでAPIをテスト
  - 質問があればユーザーに確認

- [x] 7. Chrome拡張機能の基本構造
  - [x] 7.1 プロジェクト構造の作成
    - manifest.jsonの作成（Manifest v3）
    - ディレクトリ構造の作成（popup, content, background, settings）
    - 必要な依存関係の設定
    - _Requirements: 2.1, 9.1, 10.2_

  - [x] 7.2 Extension Storageの実装
    - 設定の保存・読込機能
    - デフォルト設定の定義
    - _Requirements: 10.1_

  - [x] 7.3 Extension Storageのプロパティテスト
    - **Property 20: 設定の永続化ラウンドトリップ**
    - **Validates: Requirements 10.1, 10.5**

  - [x] 7.4 shared パッケージの typecheck 修正
    - `export type` のみのパッケージで `tsc` が `dist/` を生成しない問題を解決
    - `pnpm typecheck` が全パッケージで No errors になること
    - server / extension が `@techbook-ledger/shared` を正しく解決できること

- [x] 8. ホワイトリスト機能の実装
  - [x] 8.1 ホワイトリストマッチングの実装
    - isWhitelistedSite()関数
    - ワイルドカードパターンマッチング
    - デフォルトホワイトリスト（amazon.co.jp, gihyo.jp）
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 8.2 ホワイトリストのプロパティテスト
    - **Property 5: ホワイトリスト外サイトの機能無効化**
    - **Validates: Requirements 2.2**

  - [x] 8.3 ホワイトリストのプロパティテスト
    - **Property 6: ホワイトリスト内サイトのUI表示**
    - **Validates: Requirements 2.3**

  - [x] 8.4 ホワイトリストのプロパティテスト
    - **Property 7: ワイルドカードドメインマッチング**
    - **Validates: Requirements 2.4**

- [x] 9. JSON-LD解析の実装
  - [x] 9.1 Content Scriptの実装
    - extractJsonLd()関数: ページ内のJSON-LDブロック抽出
    - findBookData()関数: Book型オブジェクト検索と抽出
    - ISBN正規化処理
    - 必須フィールド検証
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 9.2 JSON-LD解析のプロパティテスト
    - **Property 1: JSON-LD解析の完全性**
    - **Validates: Requirements 1.2**

  - [x] 9.3 ISBN正規化のプロパティテスト
    - **Property 2: ISBN正規化の一貫性**
    - **Validates: Requirements 1.4**

  - [x] 9.4 ISBN検証のプロパティテスト
    - **Property 3: ISBN欠落時の登録拒否**
    - **Validates: Requirements 1.3**

  - [x] 9.5 複数JSON-LDブロック処理のプロパティテスト
    - **Property 4: 複数JSON-LDブロックの処理**
    - **Validates: Requirements 1.5**

- [x] 10. Popup UIの実装
  - [x] 10.1 Popup HTMLとCSSの作成
    - 書籍情報表示エリア
    - 登録ボタン
    - ステータス表示（inactive/ready/loading/success/error）
    - _Requirements: 9.1, 9.2, 9.3, 9.5_

  - [x] 10.2 Popup ロジックの実装
    - Content Scriptから書籍データ取得
    - 登録ボタンクリックハンドラ
    - Service Workerとの通信
    - 状態管理とUI更新
    - 3秒間の結果表示とリセット
    - _Requirements: 3.1, 3.6, 3.7, 9.1, 9.3, 9.4, 9.5_

  - [x] 10.3 Popup UIのユニットテスト
    - 各状態での表示確認
    - 登録フロー全体のテスト
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 11. Service Workerの実装
  - [x] 11.1 Service Workerロジックの実装
    - registerBook()関数: Local_Serverへのリクエスト送信
    - 設定読込（Extension Storage）
    - エラーハンドリング（サーバー未起動、ネットワークエラー）
    - Popup UIへのレスポンス返却
    - _Requirements: 3.1, 4.2, 7.2_

  - [x] 11.2 Service Workerのユニットテスト
    - サーバー接続エラー処理のテスト
    - レスポンス解析のテスト
    - _Requirements: 7.2_

- [x] 12. Settings Pageの実装
  - [x] 12.1 Settings UIの作成
    - サーバーエンドポイント設定フォーム
    - ホワイトリスト編集UI
    - 保存ボタンと検証
    - _Requirements: 10.2, 10.3, 10.4_

  - [x] 12.2 Settings ロジックの実装
    - validateEndpoint()関数: URL形式検証
    - saveSettings()関数: Extension Storageへの保存
    - 設定の即時反映
    - _Requirements: 10.1, 10.3, 10.5_

  - [x] 12.3 Settings検証のプロパティテスト
    - **Property 19: エンドポイント形式検証**
    - **Validates: Requirements 10.3**

- [x] 13. エラーハンドリングの統合
  - [x] 13.1 Extension側エラーメッセージの実装
    - JSON-LD解析失敗メッセージ
    - ISBN欠落メッセージ
    - サーバー接続エラーメッセージ
    - 必須フィールド欠落メッセージ
    - ネットワークエラーと再試行UI
    - _Requirements: 7.1, 7.2, 7.4, 7.5_

  - [x] 13.2 エラーメッセージのプロパティテスト
    - **Property 18: 欠落フィールドの特定**
    - **Validates: Requirements 7.4**

  - [x] 13.3 エラーハンドリングのユニットテスト
    - 各エラーケースでの適切なメッセージ表示
    - _Requirements: 7.1, 7.2, 7.5_

- [x] 14. Checkpoint - コンポーネント統合前の確認
  - [x] すべてのテストが通ることを確認
  - [x] 各コンポーネントが独立して動作することを確認
  - [x] 欠落していた Property 15 (Notion APIエラー変換) を追加
  - [x] 質問があればユーザーに確認

- [x] 15. システム統合
  - [x] 15.1 End-to-Endフローの配線
    - Content Script → Popup → Service Worker → Local Server → Notion API
    - すべてのコンポーネント間の通信を接続
    - レスポンスの逆方向フロー
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [x] 15.2 統合テスト
    - 正常登録フローのEnd-to-Endテスト
    - 重複検出フローのEnd-to-Endテスト
    - エラーケースのEnd-to-Endテスト
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 16. 最終チェックポイント
  - [x] すべてのテストが通ることを確認
  - [x] 手動テスト手順の文書化（README.md に記載）
  - [x] README.mdの作成（セットアップ手順、使用方法、アーキテクチャ、手動テスト手順）
  - [x] 質問があればユーザーに確認

---

## Auto Review Fix (Task 17)

Code Rabbit のレビュー指摘を Claude Code Action で自動修正する仕組みの導入。
詳細仕様: [docs/auto-review-fix.md](auto-review-fix.md)

- [x] 17.1 GitHub Actions ワークフローの作成
  - [x] `.github/workflows/fix-review.yml` を作成
  - [x] トリガー設定（`pull_request_review` / `submitted` / `changes_requested`）
  - [x] Code Rabbit のレビューのみにフィルタ
  - [x] ループカウント取得ステップ（PR body メタ情報方式）
  - [x] 上限到達時の通知ステップ（コメント + `needs-human-review` ラベル）
  - [x] Claude Code Action 実行ステップ（プロンプト制約含む）
  - [x] ループカウント更新ステップ

- [x] 17.2 リポジトリ設定（手動）
  - [x] GitHub Secrets に `ANTHROPIC_API_KEY` を登録
  - [ ] Branch protection で CI チェック必須を設定（CI ワークフロー未実行のため保留）
  - [x] GitHub Auto-merge を有効化
  - [x] Code Rabbit の再レビュー設定を確認

- [ ] 17.3 動作確認
  - [ ] テスト用 PR を作成し、Code Rabbit のレビューが発火することを確認
  - [ ] Claude Code Action が修正コミットをプッシュすることを確認
  - [ ] ループカウントが PR body に正しく記録されることを確認
  - [ ] 上限到達時にコメント + ラベルが付与されることを確認
  - [ ] Auto-merge が正しく動作することを確認

## Notes

- 各タスクは特定の要件を参照してトレーサビリティを確保
- チェックポイントで段階的な検証を実施
- プロパティテストは普遍的な正確性プロパティを検証
- ユニットテストは特定の例とエッジケースを検証
- プロパティテストはfast-checkを使用し、各テスト100回以上の反復を実行
