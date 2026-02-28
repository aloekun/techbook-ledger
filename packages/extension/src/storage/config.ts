import type { ExtensionConfig } from "@techbook-ledger/shared";

const STORAGE_KEY = "extensionConfig";

export const DEFAULT_CONFIG: ExtensionConfig = {
  serverEndpoint: "http://localhost:3000",
  whitelist: ["amazon.co.jp", "gihyo.jp", "*.amazon.co.jp"],
};

function normalizeConfig(raw: unknown): ExtensionConfig {
  const candidate =
    typeof raw === "object" && raw !== null
      ? (raw as Partial<ExtensionConfig>)
      : {};

  return {
    serverEndpoint:
      typeof candidate.serverEndpoint === "string" &&
      candidate.serverEndpoint.length > 0
        ? candidate.serverEndpoint
        : DEFAULT_CONFIG.serverEndpoint,
    whitelist:
      Array.isArray(candidate.whitelist) &&
      candidate.whitelist.every((v: unknown) => typeof v === "string")
        ? candidate.whitelist
        : DEFAULT_CONFIG.whitelist,
  };
}

export async function loadConfig(): Promise<ExtensionConfig> {
  const result = await chrome.storage.sync.get({
    [STORAGE_KEY]: DEFAULT_CONFIG,
  });
  return normalizeConfig(result[STORAGE_KEY]);
}

export async function saveConfig(config: ExtensionConfig): Promise<void> {
  await chrome.storage.sync.set({ [STORAGE_KEY]: config });
}
