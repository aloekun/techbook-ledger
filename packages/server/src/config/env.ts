import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import type { ServerConfig } from "@techbook-ledger/shared";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `環境変数 ${name} が設定されていません。.env ファイルを確認してください`,
    );
  }
  return value;
}

export function loadServerConfig(): ServerConfig {
  const port = Number(process.env["PORT"] ?? "3000");
  if (Number.isNaN(port) || port < 1 || port > 65535) {
    throw new Error("PORT は 1〜65535 の数値で指定してください");
  }
  const allowedExtensionOrigins = (
    process.env["ALLOWED_EXTENSION_ORIGINS"] ?? ""
  )
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  if (allowedExtensionOrigins.length === 0) {
    throw new Error(
      "環境変数 ALLOWED_EXTENSION_ORIGINS が設定されていません。" +
        "chrome-extension://<拡張機能ID> の形式でカンマ区切りで指定してください",
    );
  }

  const invalidOrigin = allowedExtensionOrigins.find((origin) => {
    try {
      const parsed = new URL(origin);
      return parsed.protocol !== "chrome-extension:";
    } catch {
      return true;
    }
  });
  if (invalidOrigin) {
    throw new Error(
      `ALLOWED_EXTENSION_ORIGINS に不正な値があります: ${invalidOrigin}。` +
        "chrome-extension://<拡張機能ID> の形式で指定してください",
    );
  }

  return {
    port,
    notionToken: requireEnv("NOTION_TOKEN"),
    notionDatabaseId: requireEnv("NOTION_DATABASE_ID"),
    allowedExtensionOrigins,
  };
}
