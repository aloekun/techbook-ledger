# Testing Strategy: techbook-ledger

## TDD (Test-Driven Development)

本プロジェクトでは TDD を必須とする。全ての機能実装は以下のサイクルに従うこと。

### Red-Green-Refactor サイクル

1. **RED**: テストを先に書く。実装前にテストが失敗することを確認する
2. **GREEN**: テストを通す最小限の実装を書く。過剰な実装をしない
3. **REFACTOR**: テストが通った状態でコードを改善する。テストが壊れないことを確認する

### TDD の実践ルール

- 実装コードを書く前に、必ず対応するテストを書く
- 1つのテストが通ったら次のテストに進む（一度に複数のテストを追加しない）
- テストが失敗した場合、テストではなく実装を修正する（テストが仕様として正しい場合）
- テスト名は「何を」「どういう条件で」「どうなるか」を明記する

## テストピラミッド

テストの量と速度のバランスを維持するため、テストピラミッドに従う。

```
        /  E2E  \           少量・低速・高コスト
       /----------\
      / Integration \       中量・中速・中コスト
     /----------------\
    /    Unit Tests     \   大量・高速・低コスト
   /____________________\
```

### 各層の役割と比率

| Layer | Ratio | Purpose | Speed |
|-------|-------|---------|-------|
| Unit | ~70% | 個別関数・ロジックの検証 | Fast (ms) |
| Integration | ~20% | コンポーネント間の連携検証 | Medium (s) |
| E2E | ~10% | ユーザー視点のフロー検証 | Slow (s-min) |

### Unit Tests

個々の関数やモジュールを独立してテストする。

**対象**:
- ISBN 正規化（`normalizeIsbn()`）
- JSON-LD パーサー（`extractJsonLd()`, `findBookData()`）
- ホワイトリストマッチング（`isWhitelistedSite()`）
- リクエストバリデーション（`validateBookRecord()`）
- エンドポイント形式検証（`validateEndpoint()`）
- Notion プロパティマッピング

**ルール**:
- 外部依存はモック化する（Notion API, Chrome Storage, DOM）
- 1テスト = 1アサーション を原則とする
- テスト間で状態を共有しない

### Integration Tests

複数コンポーネントの連携をテストする。

**対象**:
- Express API フロー: リクエスト受信 -> バリデーション -> 重複チェック -> Notion 登録 -> レスポンス
- Extension フロー: Content Script -> Popup -> Service Worker 間の通信
- エラーフローの伝播（Notion API エラー -> サーバーレスポンス -> Extension 表示）

**ルール**:
- Notion API はモック化する
- Express サーバーは実際に起動してテストする（supertest 等）
- Chrome API はモック化する

### E2E Tests

ユーザーの操作フローを端から端まで検証する。

**対象**:
- 正常登録フロー: 書籍ページ訪問 -> 情報確認 -> 登録 -> 成功通知
- 重複検出フロー: 既に登録済みの書籍を再登録 -> 重複通知
- エラーフロー: サーバー未起動時の登録試行 -> エラー通知

**ルール**:
- 実際の Notion API は手動テストまたは専用テスト環境でのみ使用
- テスト用の Notion Database を用意する（本番 DB は使わない）

## Property-Based Testing

`docs/design.md` に定義された 20 の Correctness Properties を fast-check で検証する。

### 設定

- テストライブラリ: Vitest + fast-check
- 各プロパティテスト: 最低 100 回の反復
- タグ形式: `Feature: tech-book-decision-support, Property {N}: {text}`

### プロパティテストの対象マッピング

| Properties | Component | Focus |
|------------|-----------|-------|
| 1, 2, 3, 4 | JSON-LD Parser | 解析の完全性・ISBN 正規化・欠落拒否 |
| 5, 6, 7 | Whitelist | ドメインマッチング・ワイルドカード |
| 8, 9, 10, 16, 17 | Duplicate Checker | 重複検出・ISBN 大文字小文字 |
| 11 | API Server | タイムスタンプ自動付与 |
| 12, 18 | Validator | 必須フィールド検証・欠落特定 |
| 13 | API Server | 認証情報の非露出 |
| 14 | Notion Client | プロパティマッピング |
| 15 | API Server | Notion API エラー変換 |
| 19 | Settings | エンドポイント形式検証 |
| 20 | Extension Storage | 設定の永続化ラウンドトリップ |

## Coverage

**最低カバレッジ: 80%**

| Metric | Target |
|--------|--------|
| Statements | >= 80% |
| Branches | >= 80% |
| Functions | >= 80% |
| Lines | >= 80% |

### カバレッジ除外対象

- 設定ファイル（`vite.config.ts`, `vitest.config.ts`）
- 型定義ファイル（`*.d.ts`）
- テストファイル自体

## テストの命名規約

```typescript
describe('normalizeIsbn', () => {
  it('should remove hyphens from ISBN-13', () => { ... });
  it('should remove spaces from ISBN-10', () => { ... });
  it('should return digits-only string for any formatted ISBN', () => { ... });
});
```

パターン: `should {expected behavior} when {condition}`

## テスト実行コマンド

```bash
# 全テスト実行
pnpm test

# ウォッチモード
pnpm test -- --watch

# カバレッジ付き
pnpm test -- --coverage

# 特定パッケージのテスト
pnpm --filter server test
pnpm --filter extension test
pnpm --filter shared test

# プロパティテストのみ
pnpm test -- --grep "Property"
```
