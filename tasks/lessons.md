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

## jj コマンドでテキストエディタが開く問題

### jj squash / jj describe 等で引数不足だとエディタが開きハングする
- `jj squash`（引数なし）は、親と子のコミットメッセージを統合するためにテキストエディタを開く
- 非対話環境（Claude Code など）ではエディタが応答を返さずハングする
- **回避策**: メッセージを `-m` フラグで直接指定してエディタを回避する

| コマンド | エディタが開く | エディタ回避 |
|---------|--------------|-------------|
| `jj squash` | 開く | `jj squash -m "統合後のメッセージ"` |
| `jj describe` | 開く | `jj describe -m "メッセージ"` |
| `jj commit` | 開く | `jj commit -m "メッセージ"` |
| `jj split` | 開く | 回避困難（対話的操作が必須） |

- **原則**: jj でコミットメッセージを扱うコマンドは、常に `-m` フラグを付けて実行する
- `jj squash --quiet` でも回避できない（`--quiet` はメッセージ編集を抑制しない）
- `JJ_EDITOR=true` で空エディタを代用する方法もあるが、メッセージが意図せず変わるリスクがある

## Task 17: Auto Review Fix ワークフロー

### GitHub Actions で Claude Code Action を使う場合は必ずコスト制御を設定する
- `--max-turns` を完全に削除してはならない。小さすぎる場合は適切な値に調整する（例: 15-20）
- ジョブに `timeout-minutes` を必ず設定する（例: 10 分）
- **背景**: `--max-turns 5` が小さすぎて `error_max_turns` になったため全削除したが、上限なしだと Claude が長時間走り続けてコストが膨らむ
- **正解**: 削除ではなく適切な値（15-20）に調整し、`timeout-minutes` も併用する

### pull_request_review イベントはベースブランチのワークフローを参照する
- PR ブランチのワークフローではなく、develop (ベースブランチ) 側のワークフローが実行される
- ワークフロー修正は develop にマージしないと反映されない
- テスト用 PR の前に、ワークフロー修正を先に develop にマージする必要がある

### actions/checkout は Claude Code Action の前に必須
- `actions/checkout@v4` がないと `fatal: not in a git directory` で Claude がファイルにアクセスできない
- `ref: ${{ github.event.pull_request.head.ref }}` で PR ブランチをチェックアウトする

### Code Rabbit の `request_changes_workflow: true` は再レビュー時に `COMMENTED` になる場合がある
- 初回レビューは `CHANGES_REQUESTED` だが、コード未修正のリベース後は `COMMENTED`（重複コメント扱い）で返される
- ワークフローの `if` 条件で `commented` もカバーする必要がある
- ただし `commented` は walkthrough 等の非実質的レビューでも発火するため、不要な Claude 実行が起きるリスクがある

### コスト意識を持つ — セーフガードなしでワークフローを組まない
- ユーザーから「コストを最小限に」と指示を受けたら、全ての設計判断にコスト制約を反映する
- セーフガード: `--max-turns`、`timeout-minutes`、ループカウント上限の 3 層で制御する
- 「動くようにする」と「安全に動くようにする」は別。後者を常に優先する

### CI 環境では --allowedTools を必ず設定する
- Claude Code Action はデフォルトで `Edit`, `Read`, `Write`, `Glob` 等の基本ツールと、`Bash(git add)`, `Bash(git commit)`, `Bash(git push)` のみ自動許可
- `Bash` の任意実行はデフォルト無効。`git status`, `git diff` 等も明示的に許可が必要
- `--allowedTools` 未設定だと Claude が許可外ツールを試行 → permission denial → ターン浪費 → `error_max_turns`
- **実例**: 11 ターン中 5 ターンが permission denial で浪費。$0.68 使って修正失敗
- **対策**: `--allowedTools "Bash(git:*),Grep"` を `claude_args` に追加

### CLAUDE.md のローカル専用指示が CI の Claude を混乱させる
- リポジトリの CLAUDE.md に `jj` (Jujutsu) 使用指示がある場合、CI の Claude も `jj` を使おうとする
- **対策**: CI に jj をインストールし、ローカルと同じ VCS を使用させる（一貫性を優先）

### .claude/settings.local.json が CI の permission denial の根本原因になる
- `.claude/settings.local.json` がリポジトリに追跡されている場合、CI でも checkout される
- ローカル開発用の `PreToolUse` hook（`validate-command.exe`）が Linux CI で実行不能 → 全 Bash コマンドが denied
- **実例**: 5/11 ターンが permission denied、$1.35 消費して修正失敗（2回連続）
- **対策**: CI ワークフローで `echo '{}' > .claude/settings.local.json` してローカル設定を無効化
- **長期対策**: `.claude/settings.local.json` を `.gitignore` に追加し、リポジトリから除外する

### jj config set は TOML 値として解釈される
- `jj config set --repo user.name "github-actions[bot]"` の `[bot]` が TOML セクションヘッダーとして誤解析される
- **対策**: `'"github-actions[bot]"'` のように bash の single quote で TOML の double quote を渡す

### jj tarball のパスは `./jj` (先頭にドットスラッシュ)
- `tar xzf - -C /usr/local/bin jj` では `Not found in archive`
- **対策**: `tar xzf - --strip-components=0 -C /usr/local/bin ./jj`
