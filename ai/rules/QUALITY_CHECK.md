# Quality Check: techbook-ledger

## 定量的な品質確認

タスク完了前に、以下の全チェックを実行し結果を提示すること。

### チェック項目

| # | Check | Command | Pass Criteria |
|---|-------|---------|---------------|
| 1 | Lint | `pnpm lint` | Error 0, Warning 0 |
| 2 | Type Check | `pnpm typecheck` | No errors |
| 3 | Unit / Integration Tests | `pnpm test` | All passed, coverage >= 80% |
| 4 | E2E Tests | `pnpm e2e` | All passed |
| 5 | Build | `pnpm build` | Successful |

### 結果報告フォーマット

After all checks complete, you MUST present results in this exact format:

```
### 定量品質確認フォーマット

| チェック | 結果 |
|---------|------|
| lint | ✅ X.XX/XX |
| type-check | ✅ Success (XX files) |
| テスト | ✅ XXX passed |
| E2Eテスト | ✅ XXX passed |
| ビルド | ✅ Build successful |
```

Replace values with actual results from the project:
- For lint: Show the score or error/warning count
- For type-check: Show success status and number of files checked
- For tests: Show number of unit/integration tests passed
- For E2E tests: Show E2E test results from Jenkins
- For build: Show build status

Status indicators:
- ✅ = Check passed
- ❌ = Check failed (include error details below the table)

**IMPORTANT:** Test skipping is NOT allowed. All tests must either pass (✅) or fail (❌). If a test cannot be executed, escalate to the user for guidance.

### 実行ルール

1. **全チェック必須**: 1つでもスキップした場合、タスク完了とみなさない
2. **失敗時の対応**: チェックが失敗した場合、修正してから再度全チェックを実行する
3. **報告義務**: 結果は上記フォーマットで必ずユーザーに提示する
4. **テストスキップ禁止**: `.skip` や条件付きスキップは認めない。実行できないテストはユーザーにエスカレーションする
