# TechBook Ledger

技術書の購買意思決定を支援するシステム。Chrome 拡張機能が書籍販売サイトから JSON-LD 構造化データを解析し、ローカル Express サーバー経由で Notion Database に書籍情報を登録する。

## アーキテクチャ

3 層アーキテクチャにより、セキュリティ（認証情報のブラウザ分離）と保守性を両立。

```text
Browser Page
  |
  v
Content Script --- JSON-LD parse ---> Popup UI
                                        |
                                        v
                                   Service Worker
                                        |
                                   HTTP POST (localhost:3000)
                                        |
                                        v
                                   Express API Server
                                        |
                            +-----------+-----------+
                            |           |           |
                       Validator   DupChecker   NotionClient
                                                    |
                                                    v
                                               Notion API
                                                    |
                                                    v
                                             Notion Database
```

| Layer | Technology |
|-------|-----------|
| Extension | Chrome Manifest v3, TypeScript, Vite + CRXJS |
| Server | Node.js, Express.js, TypeScript |
| Data | Notion API (@notionhq/client) |
| Test | Vitest, fast-check (property-based testing) |
| Package Manager | pnpm (workspace monorepo) |

## 前提条件

- [Node.js](https://nodejs.org/) v20 以上
- [pnpm](https://pnpm.io/) v10 以上
- [Notion](https://www.notion.so/) アカウントと API Integration
- Google Chrome ブラウザ

## セットアップ

### 1. リポジトリのクローンと依存関係のインストール

```bash
git clone https://github.com/aloekun/techbook-ledger.git
cd techbook-ledger
pnpm install
```

### 2. Notion の準備

#### 2.1 Notion Integration の作成

1. [Notion Developers](https://www.notion.so/my-integrations) にアクセス
2. 「New integration」をクリック
3. 名前を入力（例: `TechBook Ledger`）して作成
4. 「Internal Integration Secret」をコピー（`secret_...` 形式）

#### 2.2 Notion Database の作成

以下のプロパティを持つデータベースを作成する:

| プロパティ名 | タイプ | 説明 |
|------------|------|------|
| ISBN | Title | 書籍の ISBN（ユニークキー） |
| タイトル | Text | 書籍タイトル |
| 著者 | Text | 著者名 |
| 出版社 | Text | 出版社名 |
| 価格 | Number | 価格（円） |
| 発売日 | Date | 発売年月日 |
| ページ数 | Number | ページ数 |
| 登録元URL | URL | 登録元ページの URL |
| 登録日時 | Date | システム登録日時 |
| Status | Select | Wishlist / Considering / Purchased / Reading / Completed |
| 入手方法 | Select | Buy / Library / Undecided |
| 図書館利用可 | Checkbox | - |
| 所有 | Checkbox | - |
| 優先度 | Select | High / Medium / Low |
| メモ | Text | 自由記述 |

> ISBN 〜 登録日時は自動登録されるフィールド。Status 以降は手動管理用（空の状態で作成される）。

#### 2.3 Integration をデータベースに接続

1. 作成したデータベースページを開く
2. 右上の「...」メニュー → 「Connections」→ 作成した Integration を追加
3. データベースの URL から ID を取得（`https://www.notion.so/<DATABASE_ID>?v=...` の `<DATABASE_ID>` 部分）

### 3. 環境変数の設定

プロジェクトルートに `.env` ファイルを作成:

```bash
cp .env.example .env
```

`.env` を編集して実際の値を設定:

```env
NOTION_TOKEN=secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTION_DATABASE_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ALLOWED_EXTENSION_ORIGINS=chrome-extension://<your-extension-id>
PORT=3000
```

- `NOTION_TOKEN`: 手順 2.1 でコピーした Integration Secret
- `NOTION_DATABASE_ID`: 手順 2.3 で取得したデータベース ID
- `ALLOWED_EXTENSION_ORIGINS`: Chrome 拡張機能の ID（後述の手順で確認）
- `PORT`: サーバーのリッスンポート（デフォルト: 3000）

### 4. ビルド

```bash
pnpm build
```

### 5. ローカルサーバーの起動

```bash
pnpm --filter server start
```

サーバーが `http://127.0.0.1:3000` で起動する。ヘルスチェック:

```bash
curl http://127.0.0.1:3000/health
# {"status":"ok"}
```

### 6. Chrome 拡張機能のインストール

1. Chrome で `chrome://extensions/` を開く
2. 右上の「デベロッパーモード」を有効にする
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. `packages/extension/dist/` フォルダを選択
5. 拡張機能がインストールされ、ID が表示される

### 7. 拡張機能 ID の登録

1. `chrome://extensions/` で拡張機能の ID を確認（例: `abcdefghijklmnopqrstuvwxyz`）
2. `.env` の `ALLOWED_EXTENSION_ORIGINS` を更新:
   ```env
   ALLOWED_EXTENSION_ORIGINS=chrome-extension://abcdefghijklmnopqrstuvwxyz
   ```
3. サーバーを再起動する

## 使い方

### 書籍の登録

1. ローカルサーバーが起動していることを確認
2. 対応サイト（amazon.co.jp, gihyo.jp）で書籍ページを開く
3. TechBook Ledger の拡張機能アイコンをクリック
4. ポップアップに書籍情報（タイトル、著者、ISBN 等）が表示される
5. 「登録」ボタンをクリック
6. 成功時: Notion Database に書籍が登録され、成功メッセージが表示される
7. 重複時: 既に登録済みの旨が表示される（Notion ページへのリンク付き）

### 設定の変更

拡張機能の「オプション」ページから以下の設定を変更できる:

- **サーバーエンドポイント**: ローカルサーバーの URL（デフォルト: `http://localhost:3000`）
- **ホワイトリスト**: 拡張機能が動作するドメインの一覧（ワイルドカード `*.domain` 対応）

デフォルトのホワイトリスト:
- `amazon.co.jp`
- `gihyo.jp`
- `*.amazon.co.jp`

## 対応サイト

| サイト | URL | 対応状況 |
|-------|-----|---------|
| Amazon.co.jp | amazon.co.jp | JSON-LD (Schema.org Book) |
| 技術評論社 | gihyo.jp | JSON-LD (Schema.org Book) |

書籍ページに `<script type="application/ld+json">` で `@type: "Book"` の構造化データが埋め込まれているサイトであれば、ホワイトリストに追加することで対応可能。

## 開発

### ディレクトリ構成

```text
techbook-ledger/
├── packages/
│   ├── shared/       # 共有型定義・ユーティリティ (TypeScript)
│   ├── server/       # Express API サーバー (Notion 連携)
│   └── extension/    # Chrome Manifest v3 拡張機能 (Vite + CRXJS)
├── docs/             # 設計書・要件定義・タスク管理
├── ai/rules/         # AI アシスタント向けルールファイル
└── tasks/            # タスク進捗・レッスン記録
```

### 主要コマンド

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
pnpm run build:f extension

# カバレッジ付きテスト
pnpm run test:coverage:f server

# 開発サーバー
pnpm run dev:f server     # Express サーバー（ホットリロード）
pnpm run dev:f extension  # Vite 開発サーバー（HMR）
```

### テスト

Vitest + fast-check によるプロパティベーステストを採用。

| テスト種別 | ツール | 対象 |
|-----------|-------|------|
| Property-based | fast-check | 20 プロパティ、各 100+ 回反復 |
| Unit | Vitest | コンポーネント単体、エッジケース |
| Integration | Vitest | End-to-End フロー（Notion API モック） |

カバレッジ閾値: 80%

```bash
# 全テスト実行
pnpm test

# カバレッジレポート
pnpm run test:coverage:f server
pnpm run test:coverage:f extension
```

### API エンドポイント

#### `GET /health`

ヘルスチェック用。

```text
Response: {"status":"ok"}
```

#### `POST /api/books`

書籍を Notion Database に登録する。

**リクエスト:**
```json
{
  "isbn": "9784297138882",
  "title": "プログラミング TypeScript",
  "author": "Boris Cherny",
  "publisher": "オライリー・ジャパン",
  "price": 3740,
  "publicationDate": "2020-03-16",
  "pageCount": 376,
  "sourceUrl": "https://www.amazon.co.jp/dp/4297138883"
}
```

**レスポンス（成功 - 201）:**
```json
{
  "success": true,
  "message": "書籍を登録しました",
  "notionUrl": "https://www.notion.so/..."
}
```

**レスポンス（重複 - 200）:**
```json
{
  "success": false,
  "message": "この書籍は既に登録されています",
  "isDuplicate": true,
  "notionUrl": "https://www.notion.so/..."
}
```

**レスポンス（バリデーションエラー - 400）:**
```json
{
  "success": false,
  "message": "必須フィールドが欠けています: title, author"
}
```

## 手動テスト手順

ローカルサーバーと Chrome 拡張機能をインストールした状態で、以下の手順で動作確認を行う。

### テスト 1: 正常登録フロー

1. `pnpm --filter server start` でサーバーを起動
2. Chrome で [Amazon.co.jp](https://www.amazon.co.jp/) の書籍ページを開く
   - 例: 技術書の商品ページ（ISBN が JSON-LD に含まれるもの）
3. 拡張機能アイコンをクリック
4. **確認**: ポップアップに書籍情報（タイトル、著者、ISBN、価格等）が表示される
5. 「登録」ボタンをクリック
6. **確認**: ローディング表示後、「書籍を登録しました」と成功メッセージが表示される
7. **確認**: Notion Database に該当書籍のレコードが作成されている

### テスト 2: 重複検出フロー

1. テスト 1 で登録した書籍の同じページを再度開く
2. 拡張機能アイコンをクリック
3. 「登録」ボタンをクリック
4. **確認**: 「この書籍は既に登録されています」と表示される
5. **確認**: Notion Database にレコードが重複作成されていない

### テスト 3: ホワイトリスト外サイト

1. ホワイトリストに含まれないサイト（例: google.com）を開く
2. 拡張機能アイコンをクリック
3. **確認**: 「対応していないサイトです」等の非アクティブ状態が表示される

### テスト 4: サーバー未起動時のエラー

1. ローカルサーバーを停止する
2. 対応サイトの書籍ページで拡張機能アイコンをクリック
3. 「登録」ボタンをクリック
4. **確認**: 「サーバーに接続できません」等のエラーメッセージが表示される
5. **確認**: 再試行ボタンが表示される

### テスト 5: 設定ページ

1. 拡張機能の「オプション」ページを開く
2. サーバーエンドポイントを変更して「保存」をクリック
3. **確認**: 設定が保存され、次回の登録時に反映される
4. 不正な URL（例: `https://example.com`）を入力して保存
5. **確認**: バリデーションエラーが表示され、保存されない

## セキュリティ

- Notion API トークンはサーバー側の環境変数にのみ保存。ブラウザには一切露出しない
- サーバーは `127.0.0.1` のみでリッスン。外部からのアクセスは不可
- CORS は拡張機能のオリジンのみ許可
- 拡張機能のエンドポイント設定は `localhost` / `127.0.0.1` のみ受け入れ
- API レスポンスに認証情報（トークン、データベース ID）を含めない
- 全入力データをバリデーションしてから処理
- ISBN をユニークキーとして重複登録を防止

## ライセンス

MIT
