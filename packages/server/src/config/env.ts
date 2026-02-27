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
  return {
    port: Number(process.env["PORT"] ?? "3000"),
    notionToken: requireEnv("NOTION_TOKEN"),
    notionDatabaseId: requireEnv("NOTION_DATABASE_ID"),
  };
}
