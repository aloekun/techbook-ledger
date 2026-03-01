import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import type { ExtensionConfig } from "@techbook-ledger/shared";

// Mock chrome.storage.sync API
const mockStorage: Record<string, unknown> = {};

const chromeMock = {
  storage: {
    sync: {
      get: vi.fn(
        (
          keys: string | string[] | Record<string, unknown> | null,
        ): Promise<Record<string, unknown>> => {
          if (keys === null) {
            return Promise.resolve({ ...mockStorage });
          }
          if (typeof keys === "string") {
            return Promise.resolve(
              keys in mockStorage ? { [keys]: mockStorage[keys] } : {},
            );
          }
          if (Array.isArray(keys)) {
            const result: Record<string, unknown> = {};
            for (const key of keys) {
              if (key in mockStorage) {
                result[key] = mockStorage[key];
              }
            }
            return Promise.resolve(result);
          }
          // Record<string, unknown> → use defaults for missing keys
          const result: Record<string, unknown> = {};
          for (const [key, defaultValue] of Object.entries(
            keys as Record<string, unknown>,
          )) {
            result[key] = key in mockStorage ? mockStorage[key] : defaultValue;
          }
          return Promise.resolve(result);
        },
      ),
      set: vi.fn((items: Record<string, unknown>): Promise<void> => {
        Object.assign(mockStorage, items);
        return Promise.resolve();
      }),
    },
  },
  runtime: {
    lastError: null as chrome.runtime.LastError | null,
  },
};

vi.stubGlobal("chrome", chromeMock);

afterAll(() => {
  vi.unstubAllGlobals();
});

// Import after mocking chrome
const { loadConfig, saveConfig, DEFAULT_CONFIG } =
  await import("../../src/storage/config.js");

describe("Extension Storage: config", () => {
  beforeEach(() => {
    for (const key of Object.keys(mockStorage)) {
      delete mockStorage[key];
    }
    vi.clearAllMocks();
  });

  describe("DEFAULT_CONFIG", () => {
    it("should have serverEndpoint set to http://localhost:3000", () => {
      expect(DEFAULT_CONFIG.serverEndpoint).toBe("http://localhost:3000");
    });

    it("should have default whitelist with amazon.co.jp and gihyo.jp", () => {
      expect(DEFAULT_CONFIG.whitelist).toContain("amazon.co.jp");
      expect(DEFAULT_CONFIG.whitelist).toContain("gihyo.jp");
    });

    it("should have wildcard pattern *.amazon.co.jp in whitelist", () => {
      expect(DEFAULT_CONFIG.whitelist).toContain("*.amazon.co.jp");
    });
  });

  describe("loadConfig", () => {
    it("should return default config when storage is empty", async () => {
      const config = await loadConfig();

      expect(config.serverEndpoint).toBe(DEFAULT_CONFIG.serverEndpoint);
      expect(config.whitelist).toEqual(DEFAULT_CONFIG.whitelist);
    });

    it("should return stored config when available", async () => {
      const customConfig: ExtensionConfig = {
        serverEndpoint: "http://localhost:8080",
        whitelist: ["example.com"],
      };
      mockStorage["extensionConfig"] = customConfig;

      const config = await loadConfig();

      expect(config.serverEndpoint).toBe("http://localhost:8080");
      expect(config.whitelist).toEqual(["example.com"]);
    });

    it("should call chrome.storage.sync.get with correct key", async () => {
      await loadConfig();

      expect(chromeMock.storage.sync.get).toHaveBeenCalledWith({
        extensionConfig: DEFAULT_CONFIG,
      });
    });

    it("should preserve all fields from stored config", async () => {
      const customConfig: ExtensionConfig = {
        serverEndpoint: "http://127.0.0.1:4000",
        whitelist: ["bookstore.jp", "*.shop.co.jp"],
      };
      mockStorage["extensionConfig"] = customConfig;

      const config = await loadConfig();

      expect(config.serverEndpoint).toBe("http://127.0.0.1:4000");
      expect(config.whitelist).toEqual(["bookstore.jp", "*.shop.co.jp"]);
    });
  });

  describe("loadConfig (normalization)", () => {
    it("should fall back to defaults when storage contains null", async () => {
      mockStorage["extensionConfig"] = null;

      const config = await loadConfig();

      expect(config.serverEndpoint).toBe(DEFAULT_CONFIG.serverEndpoint);
      expect(config.whitelist).toEqual(DEFAULT_CONFIG.whitelist);
    });

    it("should fall back to defaults when storage contains a non-object", async () => {
      mockStorage["extensionConfig"] = "invalid";

      const config = await loadConfig();

      expect(config.serverEndpoint).toBe(DEFAULT_CONFIG.serverEndpoint);
      expect(config.whitelist).toEqual(DEFAULT_CONFIG.whitelist);
    });

    it("should fall back serverEndpoint to default when it is not a string", async () => {
      mockStorage["extensionConfig"] = {
        serverEndpoint: 12345,
        whitelist: ["example.com"],
      };

      const config = await loadConfig();

      expect(config.serverEndpoint).toBe(DEFAULT_CONFIG.serverEndpoint);
      expect(config.whitelist).toEqual(["example.com"]);
    });

    it("should fall back serverEndpoint to default when it is empty", async () => {
      mockStorage["extensionConfig"] = {
        serverEndpoint: "",
        whitelist: ["example.com"],
      };

      const config = await loadConfig();

      expect(config.serverEndpoint).toBe(DEFAULT_CONFIG.serverEndpoint);
    });

    it("should fall back whitelist to default when it contains non-strings", async () => {
      mockStorage["extensionConfig"] = {
        serverEndpoint: "http://localhost:3000",
        whitelist: ["valid.com", 123, null],
      };

      const config = await loadConfig();

      expect(config.serverEndpoint).toBe("http://localhost:3000");
      expect(config.whitelist).toEqual(DEFAULT_CONFIG.whitelist);
    });

    it("should fall back whitelist to default when it is not an array", async () => {
      mockStorage["extensionConfig"] = {
        serverEndpoint: "http://localhost:3000",
        whitelist: "not-an-array",
      };

      const config = await loadConfig();

      expect(config.whitelist).toEqual(DEFAULT_CONFIG.whitelist);
    });
  });

  describe("saveConfig", () => {
    it("should save config to chrome.storage.sync", async () => {
      const config: ExtensionConfig = {
        serverEndpoint: "http://localhost:3000",
        whitelist: ["amazon.co.jp"],
      };

      await saveConfig(config);

      expect(chromeMock.storage.sync.set).toHaveBeenCalledWith({
        extensionConfig: config,
      });
    });

    it("should persist config that can be loaded back", async () => {
      const config: ExtensionConfig = {
        serverEndpoint: "http://localhost:5000",
        whitelist: ["test.com", "*.test.org"],
      };

      await saveConfig(config);
      const loaded = await loadConfig();

      expect(loaded.serverEndpoint).toBe(config.serverEndpoint);
      expect(loaded.whitelist).toEqual(config.whitelist);
    });

    it("should overwrite existing config", async () => {
      const firstConfig: ExtensionConfig = {
        serverEndpoint: "http://localhost:3000",
        whitelist: ["first.com"],
      };
      const secondConfig: ExtensionConfig = {
        serverEndpoint: "http://localhost:4000",
        whitelist: ["second.com"],
      };

      await saveConfig(firstConfig);
      await saveConfig(secondConfig);
      const loaded = await loadConfig();

      expect(loaded.serverEndpoint).toBe("http://localhost:4000");
      expect(loaded.whitelist).toEqual(["second.com"]);
    });

    it("should handle empty whitelist", async () => {
      const config: ExtensionConfig = {
        serverEndpoint: "http://localhost:3000",
        whitelist: [],
      };

      await saveConfig(config);
      const loaded = await loadConfig();

      expect(loaded.whitelist).toEqual([]);
    });

    it("should handle whitelist with multiple entries", async () => {
      const config: ExtensionConfig = {
        serverEndpoint: "http://localhost:3000",
        whitelist: [
          "amazon.co.jp",
          "*.amazon.co.jp",
          "gihyo.jp",
          "oreilly.co.jp",
        ],
      };

      await saveConfig(config);
      const loaded = await loadConfig();

      expect(loaded.whitelist).toEqual([
        "amazon.co.jp",
        "*.amazon.co.jp",
        "gihyo.jp",
        "oreilly.co.jp",
      ]);
    });
  });
});
