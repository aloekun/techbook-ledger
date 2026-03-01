// .env の ALLOWED_EXTENSION_ORIGINS に設定するダミーオリジンを生成する。
// Chrome 拡張機能をまだインストールしていない開発初期段階で使用する。
//
// Usage: node scripts/gen-origin.js
const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
const id = Array.from({ length: 20 }, () =>
  chars[Math.floor(Math.random() * chars.length)],
).join("");
console.log(`chrome-extension://${id}`);
