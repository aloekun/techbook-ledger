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

## Task 2: Notion API連携の実装

### pnpm スクリプト経由でサブコマンドにフラグを渡す場合は `pnpm exec` を使う
- `pnpm --filter $1 test -- --coverage` だと `vitest run "--" "--coverage"` になり `--` が二重化する
- pnpm がスクリプト実行時に引数の前に自動で `--` を挿入するため
- **解決策**: `pnpm --filter $1 exec vitest run --coverage` でツールを直接実行する
- `pnpm exec` はパッケージの node_modules/.bin を PATH に追加して直接コマンドを実行する

```json
"test:coverage:f": "bash -c 'pnpm --filter $1 exec vitest run --coverage' _"
```

### @vitest/coverage-v8 のバージョンは vitest と揃える
- `@vitest/coverage-v8` と `vitest` は同じバージョンにしないと peer dependency 警告が出る
- vitest 3.2.4 なら `@vitest/coverage-v8@3.2.4` を指定する

### vi.useFakeTimers() と async リトライの相互作用に注意
- `vi.useFakeTimers()` はグローバルに全テストに影響する
- `setTimeout` を使うリトライロジックがある場合、fake timers だとタイマーが自動で進まずタイムアウトする
- **解決策**: fake timers はタイムスタンプ検証テストのみで使い、リトライテストでは `retryDelayMs: 0` を注入して real timers で実行する

## Issue #5: validate-command hook の修正

### コマンドブロック正規表現で `^` アンカーを使うとシェル演算子チェーンをすり抜ける
- `^git\s+` は `cd /path && git push` を検出できない（先頭が `cd` のため）
- **解決策**: `(^|&&|;|\|\|)\s*git\s+` のようにシェル演算子もアンカーに含める
- パイプ `|` は含めない。マークダウンテーブル `| git ... |` 等で false positive が発生するため
- `gh pr create --body "..."` のボディ内テキストもコマンド文字列として検証される点に注意

### jj bookmark は変更確定後に作成する
- `jj bookmark create <name>` を先に実行すると、空コミットに bookmark が付く
- その後 working copy で変更して `jj bookmark set <name>` しようとすると「Refusing to move bookmark backwards or sideways」エラーになる
- **回避策**: 変更 → `jj describe -m "..."` → `jj bookmark create <name>` の順で実行する
- やむを得ず移動する場合は `--allow-backwards` フラグを使う

### jj git push の初回は --allow-new が必要
- リモートに存在しない新規 bookmark を push すると「Refusing to create new remote bookmark」エラーになる
- これは jj の安全機構で、意図しないリモート bookmark 作成を防ぐ設計
- **回避策**: 初回 push 時は `jj git push --bookmark <name> --allow-new` を使う

## Task 3: 重複チェックロジックの実装

### fast-check で async コールバックには fc.asyncProperty を使う
- `fc.property` に async コールバックを渡すと、Promise が truthy 値として扱われ「Property failed by returning false」エラーになる
- **解決策**: `fc.asyncProperty` + `await fc.assert()` を使う
- sync テストには `fc.property`、async テストには `fc.asyncProperty` と使い分ける

### shared パッケージの tsbuildinfo が陳腐化すると dist が生成されない
- `tsconfig.tsbuildinfo` が残っているが `dist/` が削除されている場合、`tsc` は「変更なし」と判断して何も出力しない
- server の typecheck が `Cannot find module '@techbook-ledger/shared'` で失敗する
- **回避策**: `tsconfig.tsbuildinfo` を削除してから `pnpm run build:f shared` を実行する

### jj で feature ブランチの作業を始める前に必ず `jj new` する
- jj の working copy は親の変更（change）そのもの。`jj new` せずにファイルを追加すると、既存の変更が書き換わる
- `develop` ブックマークが付いた変更上で作業すると、develop の内容が変わり remote と divergent になる
- feature ブックマークを同じ変更に作成すると `develop = feature` になり、PR でコンフリクトする
- **手順**: `jj new` で新しい変更を作成 → 実装 → `jj describe` → `jj bookmark create`

## Task 4: リクエスト検証の実装

### develop ブックマーク競合の原因と防止策
- **発生状況**: develop 上で直接作業 → 後から `jj new @-` で feature を分離 → `develop` ブックマークが変更済み change に残ったまま → PR マージ後に remote の develop が進み → ローカル develop と競合
- **根本原因**: feature 分離時に `develop` ブックマークをリモートの位置に戻さなかった
- **防止策 (作業開始時)**:
  1. `jj git fetch` でリモート最新を取得
  2. `jj new develop` で develop の上に空の change を作成
  3. この空の change 上で作業を開始する（develop ブックマークは汚れない）
- **防止策 (誤って develop 上で作業した場合)**:
  1. `jj new @-` で feature 用の change を作成
  2. `jj restore --from <develop_change_id> -- <files>` で feature ファイルをコピー
  3. **`jj bookmark set develop -r develop@origin`** でブックマークをリモートの位置に戻す（この手順を忘れない）
  4. feature のブックマーク作成・push を進める
- **復旧方法**: `jj bookmark set develop -r <remote最新のrevision>` で解消できる
