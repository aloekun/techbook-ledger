// @vitest-environment jsdom
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
const { validateEndpoint, initSettings } = await import(
  "../../src/settings/settings.js"
);

describe("validateEndpoint", () => {
  it("should accept http://localhost:3000", () => {
    expect(validateEndpoint("http://localhost:3000")).toBe(true);
  });

  it("should accept http://localhost:8080", () => {
    expect(validateEndpoint("http://localhost:8080")).toBe(true);
  });

  it("should accept http://127.0.0.1:3000", () => {
    expect(validateEndpoint("http://127.0.0.1:3000")).toBe(true);
  });

  it("should accept http://127.0.0.1:8080", () => {
    expect(validateEndpoint("http://127.0.0.1:8080")).toBe(true);
  });

  it("should accept http://localhost without port", () => {
    expect(validateEndpoint("http://localhost")).toBe(true);
  });

  it("should accept http://127.0.0.1 without port", () => {
    expect(validateEndpoint("http://127.0.0.1")).toBe(true);
  });

  it("should reject https://localhost:3000", () => {
    expect(validateEndpoint("https://localhost:3000")).toBe(false);
  });

  it("should reject https://127.0.0.1:3000", () => {
    expect(validateEndpoint("https://127.0.0.1:3000")).toBe(false);
  });

  it("should reject http://example.com:3000", () => {
    expect(validateEndpoint("http://example.com:3000")).toBe(false);
  });

  it("should reject http://192.168.1.1:3000", () => {
    expect(validateEndpoint("http://192.168.1.1:3000")).toBe(false);
  });

  it("should reject empty string", () => {
    expect(validateEndpoint("")).toBe(false);
  });

  it("should reject non-URL strings", () => {
    expect(validateEndpoint("not-a-url")).toBe(false);
  });

  it("should reject ftp://localhost:3000", () => {
    expect(validateEndpoint("ftp://localhost:3000")).toBe(false);
  });

  it("should reject URLs with paths", () => {
    expect(validateEndpoint("http://localhost:3000/api")).toBe(false);
  });

  it("should reject URLs with trailing slash", () => {
    expect(validateEndpoint("http://localhost:3000/")).toBe(false);
  });

  it("should reject URLs with query parameters", () => {
    expect(validateEndpoint("http://localhost:3000?key=val")).toBe(false);
  });

  it("should reject port 0", () => {
    expect(validateEndpoint("http://localhost:0")).toBe(false);
  });

  it("should reject port above 65535", () => {
    expect(validateEndpoint("http://localhost:99999")).toBe(false);
  });
});

describe("Settings page: initSettings", () => {
  beforeEach(() => {
    for (const key of Object.keys(mockStorage)) {
      delete mockStorage[key];
    }
    vi.clearAllMocks();

    // Set up minimal DOM
    document.body.innerHTML = `
      <form id="settings-form">
        <input type="text" id="server-endpoint" />
        <textarea id="whitelist"></textarea>
        <button type="submit">保存</button>
        <div id="message"></div>
      </form>
    `;
  });

  it("should populate form with default config when storage is empty", async () => {
    await initSettings();

    const endpointInput = document.getElementById("server-endpoint") as HTMLInputElement;
    const whitelistTextarea = document.getElementById("whitelist") as HTMLTextAreaElement;

    expect(endpointInput.value).toBe("http://localhost:3000");
    expect(whitelistTextarea.value).toBe("amazon.co.jp\ngihyo.jp\n*.amazon.co.jp");
  });

  it("should populate form with stored config", async () => {
    const customConfig: ExtensionConfig = {
      serverEndpoint: "http://localhost:8080",
      whitelist: ["example.com", "*.test.jp"],
    };
    mockStorage["extensionConfig"] = customConfig;

    await initSettings();

    const endpointInput = document.getElementById("server-endpoint") as HTMLInputElement;
    const whitelistTextarea = document.getElementById("whitelist") as HTMLTextAreaElement;

    expect(endpointInput.value).toBe("http://localhost:8080");
    expect(whitelistTextarea.value).toBe("example.com\n*.test.jp");
  });

  it("should save valid settings when form is submitted", async () => {
    await initSettings();

    const endpointInput = document.getElementById("server-endpoint") as HTMLInputElement;
    const whitelistTextarea = document.getElementById("whitelist") as HTMLTextAreaElement;
    const form = document.getElementById("settings-form") as HTMLFormElement;

    endpointInput.value = "http://localhost:4000";
    whitelistTextarea.value = "bookstore.jp\n*.shop.co.jp";

    form.dispatchEvent(new Event("submit", { cancelable: true }));

    // Wait for async save to complete
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(chromeMock.storage.sync.set).toHaveBeenCalledWith({
      extensionConfig: {
        serverEndpoint: "http://localhost:4000",
        whitelist: ["bookstore.jp", "*.shop.co.jp"],
      },
    });
  });

  it("should show success message after saving", async () => {
    await initSettings();

    const endpointInput = document.getElementById("server-endpoint") as HTMLInputElement;
    const whitelistTextarea = document.getElementById("whitelist") as HTMLTextAreaElement;
    const form = document.getElementById("settings-form") as HTMLFormElement;

    endpointInput.value = "http://localhost:3000";
    whitelistTextarea.value = "amazon.co.jp";

    form.dispatchEvent(new Event("submit", { cancelable: true }));

    await new Promise((resolve) => setTimeout(resolve, 0));

    const message = document.getElementById("message") as HTMLDivElement;
    expect(message.textContent).toBe("設定を保存しました");
    expect(message.classList.contains("success")).toBe(true);
  });

  it("should show error message when endpoint is invalid", async () => {
    await initSettings();

    const endpointInput = document.getElementById("server-endpoint") as HTMLInputElement;
    const whitelistTextarea = document.getElementById("whitelist") as HTMLTextAreaElement;
    const form = document.getElementById("settings-form") as HTMLFormElement;

    endpointInput.value = "http://example.com:3000";
    whitelistTextarea.value = "amazon.co.jp";

    form.dispatchEvent(new Event("submit", { cancelable: true }));

    await new Promise((resolve) => setTimeout(resolve, 0));

    const message = document.getElementById("message") as HTMLDivElement;
    expect(message.textContent).toBe(
      "エンドポイントはlocalhostまたは127.0.0.1のHTTP URLを指定してください",
    );
    expect(message.classList.contains("error")).toBe(true);
  });

  it("should not save when endpoint is invalid", async () => {
    await initSettings();

    const endpointInput = document.getElementById("server-endpoint") as HTMLInputElement;
    const whitelistTextarea = document.getElementById("whitelist") as HTMLTextAreaElement;
    const form = document.getElementById("settings-form") as HTMLFormElement;

    endpointInput.value = "https://malicious.com";
    whitelistTextarea.value = "amazon.co.jp";

    form.dispatchEvent(new Event("submit", { cancelable: true }));

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(chromeMock.storage.sync.set).not.toHaveBeenCalled();
  });

  it("should filter out empty lines from whitelist", async () => {
    await initSettings();

    const endpointInput = document.getElementById("server-endpoint") as HTMLInputElement;
    const whitelistTextarea = document.getElementById("whitelist") as HTMLTextAreaElement;
    const form = document.getElementById("settings-form") as HTMLFormElement;

    endpointInput.value = "http://localhost:3000";
    whitelistTextarea.value = "amazon.co.jp\n\ngihyo.jp\n\n";

    form.dispatchEvent(new Event("submit", { cancelable: true }));

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(chromeMock.storage.sync.set).toHaveBeenCalledWith({
      extensionConfig: {
        serverEndpoint: "http://localhost:3000",
        whitelist: ["amazon.co.jp", "gihyo.jp"],
      },
    });
  });

  it("should trim whitespace from whitelist entries", async () => {
    await initSettings();

    const endpointInput = document.getElementById("server-endpoint") as HTMLInputElement;
    const whitelistTextarea = document.getElementById("whitelist") as HTMLTextAreaElement;
    const form = document.getElementById("settings-form") as HTMLFormElement;

    endpointInput.value = "http://localhost:3000";
    whitelistTextarea.value = "  amazon.co.jp  \n  gihyo.jp  ";

    form.dispatchEvent(new Event("submit", { cancelable: true }));

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(chromeMock.storage.sync.set).toHaveBeenCalledWith({
      extensionConfig: {
        serverEndpoint: "http://localhost:3000",
        whitelist: ["amazon.co.jp", "gihyo.jp"],
      },
    });
  });

  it("should allow saving empty whitelist", async () => {
    await initSettings();

    const endpointInput = document.getElementById("server-endpoint") as HTMLInputElement;
    const whitelistTextarea = document.getElementById("whitelist") as HTMLTextAreaElement;
    const form = document.getElementById("settings-form") as HTMLFormElement;

    endpointInput.value = "http://localhost:3000";
    whitelistTextarea.value = "";

    form.dispatchEvent(new Event("submit", { cancelable: true }));

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(chromeMock.storage.sync.set).toHaveBeenCalledWith({
      extensionConfig: {
        serverEndpoint: "http://localhost:3000",
        whitelist: [],
      },
    });
  });

  it("should trim whitespace from endpoint URL", async () => {
    await initSettings();

    const endpointInput = document.getElementById("server-endpoint") as HTMLInputElement;
    const whitelistTextarea = document.getElementById("whitelist") as HTMLTextAreaElement;
    const form = document.getElementById("settings-form") as HTMLFormElement;

    endpointInput.value = "  http://localhost:3000  ";
    whitelistTextarea.value = "amazon.co.jp";

    form.dispatchEvent(new Event("submit", { cancelable: true }));

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(chromeMock.storage.sync.set).toHaveBeenCalledWith({
      extensionConfig: {
        serverEndpoint: "http://localhost:3000",
        whitelist: ["amazon.co.jp"],
      },
    });
  });

  it("should show error message when saveConfig fails", async () => {
    chromeMock.storage.sync.set.mockRejectedValueOnce(new Error("storage error"));

    await initSettings();

    const endpointInput = document.getElementById("server-endpoint") as HTMLInputElement;
    const whitelistTextarea = document.getElementById("whitelist") as HTMLTextAreaElement;
    const form = document.getElementById("settings-form") as HTMLFormElement;

    endpointInput.value = "http://localhost:3000";
    whitelistTextarea.value = "amazon.co.jp";

    form.dispatchEvent(new Event("submit", { cancelable: true }));

    await new Promise((resolve) => setTimeout(resolve, 0));

    const message = document.getElementById("message") as HTMLDivElement;
    expect(message.textContent).toBe("設定の保存に失敗しました。再度お試しください。");
    expect(message.classList.contains("error")).toBe(true);
  });

  it("should return early when required DOM elements are missing", async () => {
    document.body.innerHTML = "<div>no form here</div>";

    await initSettings();

    expect(chromeMock.storage.sync.get).toHaveBeenCalled();
    expect(chromeMock.storage.sync.set).not.toHaveBeenCalled();
  });
});
