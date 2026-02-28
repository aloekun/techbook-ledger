import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import fc from "fast-check";
import type { ExtensionConfig } from "@techbook-ledger/shared";

// Mock chrome.storage.sync API with an in-memory store
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

const { loadConfig, saveConfig, DEFAULT_CONFIG } = await import(
  "../../src/storage/config.js"
);

// Arbitraries for generating valid ExtensionConfig
const localhostEndpointArb = fc.oneof(
  fc.integer({ min: 1, max: 65535 }).map((port) => `http://localhost:${port}`),
  fc
    .integer({ min: 1, max: 65535 })
    .map((port) => `http://127.0.0.1:${port}`),
);

const domainArb = fc
  .tuple(
    fc.stringOf(fc.constantFrom(...("abcdefghijklmnopqrstuvwxyz".split(""))), {
      minLength: 2,
      maxLength: 10,
    }),
    fc.constantFrom(".com", ".co.jp", ".jp", ".org", ".net"),
  )
  .map(([name, tld]) => name + tld);

const wildcardDomainArb = domainArb.map((d) => `*.${d}`);

const whitelistArb = fc.array(fc.oneof(domainArb, wildcardDomainArb), {
  minLength: 0,
  maxLength: 10,
});

const extensionConfigArb: fc.Arbitrary<ExtensionConfig> = fc.record({
  serverEndpoint: localhostEndpointArb,
  whitelist: whitelistArb,
});

describe("Feature: tech-book-decision-support, Property 20: 設定の永続化ラウンドトリップ", () => {
  beforeEach(() => {
    for (const key of Object.keys(mockStorage)) {
      delete mockStorage[key];
    }
    vi.clearAllMocks();
  });

  it("should round-trip: saveConfig then loadConfig returns the same config", async () => {
    await fc.assert(
      fc.asyncProperty(extensionConfigArb, async (config) => {
        // Clear storage before each iteration
        for (const key of Object.keys(mockStorage)) {
          delete mockStorage[key];
        }

        await saveConfig(config);
        const loaded = await loadConfig();

        expect(loaded.serverEndpoint).toBe(config.serverEndpoint);
        expect(loaded.whitelist).toEqual(config.whitelist);
      }),
      { numRuns: 100 },
    );
  });

  it("should return default config when nothing has been saved", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        // Ensure storage is empty
        for (const key of Object.keys(mockStorage)) {
          delete mockStorage[key];
        }

        const loaded = await loadConfig();

        expect(loaded.serverEndpoint).toBe(DEFAULT_CONFIG.serverEndpoint);
        expect(loaded.whitelist).toEqual(DEFAULT_CONFIG.whitelist);
      }),
      { numRuns: 100 },
    );
  });

  it("should preserve whitelist order through round-trip", async () => {
    await fc.assert(
      fc.asyncProperty(extensionConfigArb, async (config) => {
        for (const key of Object.keys(mockStorage)) {
          delete mockStorage[key];
        }

        await saveConfig(config);
        const loaded = await loadConfig();

        // Verify exact ordering is preserved
        for (let i = 0; i < config.whitelist.length; i++) {
          expect(loaded.whitelist[i]).toBe(config.whitelist[i]);
        }
        expect(loaded.whitelist.length).toBe(config.whitelist.length);
      }),
      { numRuns: 100 },
    );
  });

  it("should overwrite previous config completely on save", async () => {
    await fc.assert(
      fc.asyncProperty(
        extensionConfigArb,
        extensionConfigArb,
        async (firstConfig, secondConfig) => {
          for (const key of Object.keys(mockStorage)) {
            delete mockStorage[key];
          }

          await saveConfig(firstConfig);
          await saveConfig(secondConfig);
          const loaded = await loadConfig();

          expect(loaded.serverEndpoint).toBe(secondConfig.serverEndpoint);
          expect(loaded.whitelist).toEqual(secondConfig.whitelist);
        },
      ),
      { numRuns: 100 },
    );
  });
});
