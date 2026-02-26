# Requirements Document

## Introduction

techbook-ledgerは、技術書の購買意思決定を支援するPC専用ブラウザ拡張機能です。ユーザーが技術書販売サイトを閲覧中に書籍情報を簡単に登録し、Notion上で一元管理することで、「すぐ買うべきか」「図書館で借りられるか」「本当に読む優先度が高いか」を判断できるようにします。

本システムはローカルサーバー方式を採用し、ブラウザ拡張機能、ローカル中継API、Notion APIの3層構成で実現します。これにより、セキュアな認証情報管理と将来的なクラウド移行の柔軟性を両立します。

## 用語集

- **Extension（拡張機能）**: Chrome拡張機能（Manifest v3）。技術書販売サイトから書籍情報を抽出し、Local_Serverに送信する
- **Local_Server（ローカルサーバー）**: ローカル環境で動作するNode.js製の中継APIサーバー。Notion認証情報を管理し、重複チェックとNotion API連携を担当する
- **Notion_Database（Notionデータベース）**: Notion上の書籍管理データベース。書籍情報とステータス管理を保持する
- **Book_Record（書籍レコード）**: 書籍情報レコード。ISBN、タイトル、著者、出版社、価格、発売日、ページ数、登録元URL、登録日時を含む
- **JSON-LD**: 構造化データ形式。技術書販売サイトのHTMLに埋め込まれた書籍メタデータ
- **Whitelisted_Site（ホワイトリスト登録サイト）**: 登録対象として許可された技術書販売サイト（Amazon、技術評論社など）

## 要件

### 要件1: 書籍情報の抽出

**ユーザーストーリー:** ユーザーとして、技術書サイトから書籍情報を抽出したい。なぜなら、手動入力なしで素早く書籍詳細を取得できるから。

#### 受け入れ基準

1. WHEN ユーザーがWhitelisted_Siteを訪問する、THE Extension SHALL ページのJSON-LDデータを解析する
2. WHEN JSON-LDにBook型オブジェクトが含まれる、THE Extension SHALL ISBN、タイトル、著者、出版社、価格、発売日、ページ数を抽出する
3. WHEN 抽出データにISBNが存在しない、THE Extension SHALL 登録を防止しユーザーに通知する
4. THE Extension SHALL ハイフンと空白を除去してISBNを正規化する
5. WHEN ページに複数のJSON-LDブロックが存在する、THE Extension SHALL すべてのブロックを処理し最初の有効なBook型オブジェクトを選択する

### 要件2: ホワイトリスト制御

**ユーザーストーリー:** システム管理者として、承認された技術書サイトのみに書籍登録を制限したい。なぜなら、システムが関連コンテンツのみを処理するようにするため。

#### 受け入れ基準

1. THE Extension SHALL 承認されたドメインパターンのホワイトリストを保持する
2. WHEN ユーザーがホワイトリスト外のサイトを訪問する、THE Extension SHALL 抽出機能を起動しない
3. WHEN ユーザーがWhitelisted_Siteを訪問する、THE Extension SHALL 登録UIを表示する
4. THE Extension SHALL サイトのバリエーションに対応するワイルドカードドメインマッチングをサポートする

### 要件3: 書籍登録処理

**ユーザーストーリー:** ユーザーとして、ワンクリックでNotionデータベースに書籍を登録したい。なぜなら、意思決定支援データベースを効率的に構築できるから。

#### 受け入れ基準

1. WHEN ユーザーが登録ボタンをクリックする、THE Extension SHALL Book_RecordをLocal_Serverに送信する
2. WHEN Local_ServerがBook_Recordを受信する、THE Local_Server SHALL 同じISBNを持つ既存レコードをNotion_Databaseに問い合わせる
3. IF 同じISBNのレコードが存在する、THEN THE Local_Server SHALL 重複通知を返し新規レコードを作成しない
4. IF 重複が存在しない、THEN THE Local_Server SHALL Notion_Databaseに新規レコードを作成する
5. WHEN レコードが作成される、THE Local_Server SHALL 登録タイムスタンプを追加する
6. WHEN 登録が正常に完了する、THE Extension SHALL ユーザーに成功通知を表示する
7. WHEN 登録が失敗する、THE Extension SHALL 失敗理由を含むエラーメッセージを表示する

### 要件4: ローカルサーバー通信

**ユーザーストーリー:** 開発者として、拡張機能がローカルサーバーと通信するようにしたい。なぜなら、機密認証情報がブラウザ拡張機能に露出されないようにするため。

#### 受け入れ基準

1. THE Local_Server SHALL localhostポートのみでリッスンする
2. THE Local_Server SHALL CORS設定されたヘッダーでExtensionからのPOSTリクエストを受け付ける
3. WHEN Local_Serverが登録リクエストを受信する、THE Local_Server SHALL リクエストに必要なすべてのBook_Recordフィールドが含まれることを検証する
4. THE Local_Server SHALL 環境変数からNotion API認証情報を読み込む
5. THE Local_Server SHALL APIレスポンスでNotion認証情報を露出しない
6. WHEN Local_ServerがNotion APIに接続できない、THE Local_Server SHALL 適切なエラーレスポンスを返す

### 要件5: Notion API連携

**ユーザーストーリー:** ユーザーとして、書籍レコードをNotionに保存したい。なぜなら、Notionの強力なデータベース機能を使って管理・閲覧できるから。

#### 受け入れ基準

1. THE Local_Server SHALL 環境変数からのトークンを使用してNotion APIで認証する
2. WHEN レコードを作成する、THE Local_Server SHALL Book_RecordフィールドをNotion_Databaseプロパティにマッピングする
3. THE Local_Server SHALL 次のNotionプロパティでレコードを作成する：ISBN（ユニークキー）、タイトル、著者、出版社、価格、発売日、ページ数、登録元URL、登録日時
4. WHEN Notion APIがエラーを返す、THE Local_Server SHALL エラーを解析しユーザーフレンドリーなメッセージを返す
5. THE Local_Server SHALL Notion APIのレート制限を適切に処理する

### 要件6: データ整合性

**ユーザーストーリー:** ユーザーとして、重複した書籍が登録されないようにしたい。なぜなら、データベースをクリーンで正確に保つため。

#### 受け入れ基準

1. WHEN 重複をチェックする、THE Local_Server SHALL ISBNでNotion_Databaseに問い合わせる
2. THE Local_Server SHALL 重複検出のためISBNを大文字小文字を区別せずに扱う
3. WHEN 重複が検出される、THE Local_Server SHALL 既存レコードのNotion URLを返す
4. THE Local_Server SHALL 新規レコード作成前に重複チェックを完了する

### 要件7: エラーハンドリング

**User Story:** ユーザーとして、登録失敗時に明確なエラーメッセージが欲しい。なぜなら、何が問題だったかを理解し適切な対応を取れるから。

#### 受け入れ基準

1. WHEN JSON-LD解析が失敗する、THE Extension SHALL ページ構造がサポートされていないことを示すメッセージを表示する
2. WHEN Local_Serverに到達できない、THE Extension SHALL ローカルサーバーを起動するよう指示するメッセージを表示する
3. WHEN Notion API認証が失敗する、THE Local_Server SHALL 認証エラーメッセージを返す
4. WHEN 抽出データに必須フィールドが欠けている、THE Extension SHALL どのフィールドが欠けているかを表示する
5. WHEN ネットワークエラーが発生する、THE Extension SHALL 再試行オプションを表示する

### 要件8: セキュリティ

**ユーザーストーリー:** セキュリティ意識の高いユーザーとして、Notion認証情報を保護したい。なぜなら、データベースへの不正アクセスを防ぐため。

#### 受け入れ基準

1. THE Extension SHALL Notion API認証情報を保存または送信しない
2. THE Local_Server SHALL 環境変数からのみNotion認証情報を読み込む
3. THE Local_Server SHALL localhostインターフェースのみにバインドする
4. THE Local_Server SHALL 処理前にすべての受信リクエストに必須フィールドが含まれることを検証する
5. THE Extension SHALL localhostエンドポイントとのみ通信する

### 要件9: 拡張機能UI

**ユーザーストーリー:** ユーザーとして、シンプルなブラウザ拡張機能インターフェースが欲しい。なぜなら、ブラウジング体験を妨げずに書籍を登録できるから。

#### 受け入れ基準

1. WHEN ユーザーが有効な書籍データを持つWhitelisted_Siteを訪問する、THE Extension SHALL ポップアップUIに登録ボタンを表示する
2. WHEN ユーザーがホワイトリスト外のサイトまたは書籍データのないページを訪問する、THE Extension SHALL 非アクティブ状態を表示する
3. WHEN 登録が進行中である、THE Extension SHALL ローディングインジケーターを表示する
4. WHEN 登録が完了する、THE Extension SHALL リセット前に3秒間結果を表示する
5. THE Extension SHALL 登録前にユーザー確認のため抽出された書籍情報をポップアップに表示する

### 要件10: 設定管理

**ユーザーストーリー:** ユーザーとして、ローカルサーバーエンドポイントとホワイトリストを設定したい。なぜなら、自分の環境に合わせてシステムをカスタマイズできるから。

#### 受け入れ基準

1. THE Extension SHALL Local_ServerエンドポイントURLを拡張機能ストレージに保存する
2. THE Extension SHALL サーバーエンドポイント設定用の設定ページを提供する
3. THE Extension SHALL 保存前にサーバーエンドポイント形式を検証する
4. THE Extension SHALL 設定ページを通じてサイトホワイトリストの閲覧と変更を許可する
5. WHEN 設定が更新される、THE Extension SHALL ブラウザ再起動なしで変更を適用する

