# Project Architecture: techbook-ledger

## Overview

techbook-ledger は、技術書の購買意思決定を支援する3層アーキテクチャのシステムです。

- **Chrome Extension（フロントエンド）**: 書籍販売サイトから JSON-LD を解析し書籍情報を抽出
- **Local Server（中継層）**: Node.js + Express で認証情報を管理し、重複チェック・Notion API 連携を担当
- **Notion Database（永続化層）**: 書籍情報の保存・管理

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Extension | Chrome Manifest v3, TypeScript, Vite + CRXJS |
| Server | Node.js, Express.js, TypeScript |
| Data | Notion API (@notionhq/client) |
| Test | Vitest, fast-check (property-based testing) |
| Package Manager | pnpm (workspace monorepo) |
| Linter / Formatter | ESLint, Prettier |
| Environment | dotenv |

## System Architecture

```
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

### Architecture Decision Records

| Decision | Rationale |
|----------|-----------|
| 3層分離 | セキュリティ（認証情報のブラウザ分離）、保守性、将来のクラウド移行 |
| ローカルサーバー方式 | Notion API トークンをブラウザに持たせない |
| ISBN をユニークキー | 重複登録を防止し、データの一意性を保証 |
| Vite + CRXJS | HMR 対応で Chrome 拡張の高速開発。Manifest v3 ネイティブ対応 |
| pnpm workspace | Extension と Server のコード・型定義を効率的に共有 |

## Directory Structure

```
techbook-ledger/
+-- CLAUDE.md                          # Claude Code instructions
+-- pnpm-workspace.yaml                # pnpm workspace config
+-- package.json                       # Root package.json (scripts, devDeps)
+-- tsconfig.base.json                 # Shared TypeScript config
+-- .gitignore
+-- .env.example                       # Environment variable template
+--
+-- docs/
|   +-- design.md                      # System design document
|   +-- requirements.md                # Requirements document
|   +-- tasks.md                       # Implementation plan
+--
+-- ai/
|   +-- rules/
|       +-- PROJECT_ARCHITECTURE.md    # This file
|       +-- GIT_WORKFLOW.md            # Branch/commit/PR conventions
+--
+-- packages/
|   +-- shared/                        # Shared types and utilities
|   |   +-- package.json
|   |   +-- tsconfig.json
|   |   +-- src/
|   |       +-- types/
|   |       |   +-- book.ts            # BookData, BookRecord interfaces
|   |       |   +-- api.ts             # Request/Response types
|   |       |   +-- config.ts          # Configuration types
|   |       +-- utils/
|   |           +-- isbn.ts            # ISBN normalization
|   |           +-- validation.ts      # Shared validation logic
|   |
|   +-- server/                        # Local Node.js server
|   |   +-- package.json
|   |   +-- tsconfig.json
|   |   +-- src/
|   |   |   +-- index.ts              # Entry point, Express setup
|   |   |   +-- routes/
|   |   |   |   +-- books.ts          # POST /api/books handler
|   |   |   +-- services/
|   |   |   |   +-- notion-client.ts  # Notion API wrapper
|   |   |   |   +-- duplicate-checker.ts
|   |   |   +-- middleware/
|   |   |   |   +-- cors.ts           # CORS configuration
|   |   |   |   +-- validator.ts      # Request validation middleware
|   |   |   +-- config/
|   |   |       +-- env.ts            # Environment variable loading
|   |   +-- tests/
|   |       +-- unit/
|   |       +-- property/
|   |       +-- integration/
|   |
|   +-- extension/                     # Chrome extension
|       +-- package.json
|       +-- tsconfig.json
|       +-- vite.config.ts             # Vite + CRXJS config
|       +-- manifest.json              # Chrome Manifest v3
|       +-- src/
|       |   +-- content/
|       |   |   +-- index.ts           # Content script entry
|       |   |   +-- json-ld-parser.ts  # JSON-LD extraction
|       |   |   +-- whitelist.ts       # Domain whitelist matching
|       |   +-- popup/
|       |   |   +-- index.html
|       |   |   +-- popup.ts           # Popup logic
|       |   |   +-- popup.css
|       |   +-- background/
|       |   |   +-- service-worker.ts  # Background service worker
|       |   +-- settings/
|       |   |   +-- index.html
|       |   |   +-- settings.ts        # Settings page logic
|       |   |   +-- settings.css
|       |   +-- storage/
|       |       +-- config.ts          # Chrome Storage wrapper
|       +-- tests/
|           +-- unit/
|           +-- property/
+--
+-- tasks/
    +-- todo.md                        # Task tracking
    +-- lessons.md                     # Lessons learned
```

## Commands

### Root (workspace)

```bash
# Install dependencies
pnpm install

# Run all tests
pnpm test

# Lint
pnpm lint

# Type check
pnpm typecheck
```

### Per-package (filter shorthand)

`bash -c` + 位置パラメータにより、パッケージ名を引数で受け取るスクリプト。
`--` は付けずに呼び出す。

```bash
# Type check (single package)
pnpm run typecheck:f shared
pnpm run typecheck:f server

# Test (single package)
pnpm run test:f shared
pnpm run test:f server

# Build (single package)
pnpm run build:f shared
pnpm run build:f server

# Dev server (single package)
pnpm run dev:f server
```

### Per-package (direct filter)

```bash
# Start production server
pnpm --filter server start
```

## Key Data Models

### BookData (Extension -> Server)

```typescript
interface BookData {
  isbn: string;           // Normalized (digits only, 10 or 13)
  title: string;
  author: string;
  publisher: string;
  price: number;          // JPY
  publicationDate: string; // YYYY-MM-DD
  pageCount: number;
  sourceUrl: string;
}
```

### RegistrationResponse (Server -> Extension)

```typescript
interface RegistrationResponse {
  success: boolean;
  message: string;
  notionUrl?: string;
  isDuplicate?: boolean;
}
```

## API Endpoints

### `POST /api/books`

書籍レコードを Notion Database に登録する。

| Item | Detail |
|------|--------|
| URL | `http://localhost:3000/api/books` |
| Method | POST |
| Content-Type | application/json |
| Body | `BookData` |

**Response codes:**

| Status | Scenario |
|--------|----------|
| 201 | Created successfully |
| 200 | Duplicate detected (returns existing Notion URL) |
| 400 | Validation error (missing/invalid fields) |
| 429 | Notion API rate limited |
| 500 | Notion auth error |
| 503 | Notion connection error |

## Configuration

### Server (.env)

```
NOTION_TOKEN=secret_...
NOTION_DATABASE_ID=...
PORT=3000  # optional, default: 3000
```

### Extension (Chrome Storage)

```typescript
{
  serverEndpoint: "http://localhost:3000",  // localhost only
  whitelist: ["amazon.co.jp", "gihyo.jp", "*.amazon.co.jp"]
}
```

## Security Constraints

- Notion API トークンはサーバーの環境変数にのみ保存（ブラウザに露出しない）
- サーバーは `127.0.0.1` のみでリッスン
- CORS は拡張機能からのリクエストのみ許可
- エンドポイント設定は localhost/127.0.0.1 のみ受け入れ
- API レスポンスに認証情報を含めない
- 全入力データをバリデーションしてから処理

## Testing Strategy

| Type | Tool | Purpose |
|------|------|---------|
| Property-based | Vitest + fast-check | 20 properties, 100+ iterations each |
| Unit | Vitest | Components, edge cases, error conditions |
| Integration | Vitest | End-to-end flow (Notion API mocked) |

**Coverage target**: 80%+

Property tests は `docs/design.md` の Correctness Properties (Property 1-20) に対応。

## Notion Database Schema

Auto-populated on creation:

| Property | Type | Source |
|----------|------|--------|
| ISBN | Title | BookData.isbn |
| タイトル | Text | BookData.title |
| 著者 | Text | BookData.author |
| 出版社 | Text | BookData.publisher |
| 価格 | Number | BookData.price |
| 発売日 | Date | BookData.publicationDate |
| ページ数 | Number | BookData.pageCount |
| 登録元URL | URL | BookData.sourceUrl |
| 登録日時 | Date | Server-generated |

Manual management (empty on creation):

| Property | Type | Options |
|----------|------|---------|
| Status | Select | Wishlist / Considering / Purchased / Reading / Completed |
| 入手方法 | Select | Buy / Library / Undecided |
| 図書館利用可 | Checkbox | - |
| 所有 | Checkbox | - |
| 優先度 | Select | High / Medium / Low |
| メモ | Text | Free-form |
