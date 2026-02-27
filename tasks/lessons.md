# Lessons Learned

## Task 1: ローカルサーバーのセットアップ

### pnpm workspace で workspace:* は自前パッケージのみ
- `typescript`, `vitest` 等の外部パッケージに `workspace:*` は使えない
- `workspace:*` はモノレポ内の `@techbook-ledger/shared` のような自前パッケージ専用
- 共通ツールはルートの devDependencies に置いてホイスティングで共有する

### dotenv のパス解決に注意
- `pnpm --filter server dev` は `packages/server/` を CWD として実行する
- dotenv.config() はデフォルトで CWD の `.env` を探す
- ルートの `.env` を読む場合は `import.meta.url` 基準で正しいパスを指定する
- `src/config/env.ts` からルートは 4 階層上 (`../../../../.env`)

### TypeScript project references に composite が必要
- 参照先パッケージの tsconfig に `"composite": true` がないと TS6306 エラーになる

### Express の型エクスポートに明示的な型注釈が必要
- `const app = express()` の推論型がポータブルでない場合がある
- `const app: Express = express()` と明示的に注釈する

### pnpm スクリプトで引数にフォルダ・パッケージ名を受け取る方法
- pnpm の `--filter` はスクリプトの引数ではなく pnpm CLI のフラグ
- スクリプト末尾に引数が追加される pnpm の仕様では、コマンド途中に引数を挿入できない
- **解決策**: `bash -c` + 位置パラメータで引数を任意の位置に挿入する

```json
"typecheck:f": "bash -c 'pnpm --filter $1 typecheck' _",
"test:f":      "bash -c 'pnpm --filter $1 test' _",
"build:f":     "bash -c 'pnpm --filter $1 build' _"
```

- `_` は `$0`（スクリプト名）のプレースホルダ。実際の引数は `$1` 以降に入る
- 呼び出し: `pnpm run typecheck:f shared` （`--` は付けない）
- `--` を付けると pnpm がそれを `$1` に渡してしまい意図通り動かない
- Windows (bash シェル環境) でも動作確認済み

**Claude Code の permissions 設定との連携**:
- スクリプトにフォルダ名を含めないため、パッケージが増えてもスクリプト追加不要
- permissions は `Bash(pnpm run typecheck:f:*)` のように登録する
- これにより任意パッケージ名を引数で渡せるが、許可されるのはこのスクリプトのみ
- `Bash(pnpm --filter:*)` のような広範な許可を避けてセキュリティを確保できる

### PR レビュー修正後はコミット・プッシュまで一気に実施する
- レビュー指摘の修正が完了したら、ユーザーの指示を待たずにコミット・プッシュまで実施する
- 修正 → コミット → プッシュを1つの流れとして扱う

### `Closes #N` は デフォルトブランチへのマージ時のみ自動クローズされる
- GitHub の `Closes #N` キーワードはデフォルトブランチ（main）へのマージ時のみ発動する
- `develop` へのマージでは Issue は自動クローズされない
- Git Flow 運用では `develop` → `main` マージ時に自動クローズされるのを待つ
