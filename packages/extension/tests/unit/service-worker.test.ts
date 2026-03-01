import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import type {
  BookData,
  RegistrationResponse,
  ExtensionConfig,
} from "@techbook-ledger/shared";

// Mock chrome API
const chromeMock = {
  runtime: {
    onMessage: {
      addListener: vi.fn(),
    },
  },
  storage: {
    sync: {
      get: vi.fn(
        (
          keys: string | string[] | Record<string, unknown> | null,
        ): Promise<Record<string, unknown>> => {
          if (keys === null) return Promise.resolve({});
          if (typeof keys === "object" && !Array.isArray(keys)) {
            return Promise.resolve({ ...keys });
          }
          return Promise.resolve({});
        },
      ),
      set: vi.fn((): Promise<void> => Promise.resolve()),
    },
  },
};

vi.stubGlobal("chrome", chromeMock);

afterAll(() => {
  vi.unstubAllGlobals();
});

// Import after mocking chrome
const {
  registerBook,
  parseRegistrationResponse,
  isRegisterBookMessage,
  setupMessageListener,
} = await import("../../src/background/service-worker.js");

const sampleBookData: BookData = {
  isbn: "9784297138189",
  title: "TypeScript入門",
  author: "鈴木僚太",
  publisher: "技術評論社",
  price: 3278,
  publicationDate: "2022-04-22",
  pageCount: 424,
  sourceUrl: "https://gihyo.jp/book/2022/978-4-297-13818-9",
};

const defaultConfig: ExtensionConfig = {
  serverEndpoint: "http://localhost:3000",
  whitelist: ["amazon.co.jp", "gihyo.jp", "*.amazon.co.jp"],
};

function createMockResponse(
  body: unknown,
  status: number = 200,
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

function createMockLoadConfig(
  config: ExtensionConfig = defaultConfig,
): () => Promise<ExtensionConfig> {
  return vi.fn().mockResolvedValue(config);
}

describe("Service Worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("registerBook", () => {
    it("should send POST request and return success response", async () => {
      const serverResponse: RegistrationResponse = {
        success: true,
        message: "書籍を登録しました",
        notionUrl: "https://notion.so/page-id",
      };
      const mockFetch = vi.fn().mockResolvedValue(
        createMockResponse(serverResponse, 201),
      );

      const result = await registerBook(sampleBookData, {
        loadConfig: createMockLoadConfig(),
        fetchFn: mockFetch,
      });

      expect(result).toEqual(serverResponse);
    });

    it("should send correct headers and body", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        createMockResponse({ success: true, message: "OK" }, 201),
      );

      await registerBook(sampleBookData, {
        loadConfig: createMockLoadConfig(),
        fetchFn: mockFetch,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/books",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sampleBookData),
        },
      );
    });

    it("should use serverEndpoint from loaded config", async () => {
      const customConfig: ExtensionConfig = {
        serverEndpoint: "http://127.0.0.1:4000",
        whitelist: [],
      };
      const mockFetch = vi.fn().mockResolvedValue(
        createMockResponse({ success: true, message: "OK" }, 201),
      );

      await registerBook(sampleBookData, {
        loadConfig: createMockLoadConfig(customConfig),
        fetchFn: mockFetch,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "http://127.0.0.1:4000/api/books",
        expect.any(Object),
      );
    });

    it("should return duplicate response from server", async () => {
      const duplicateResponse: RegistrationResponse = {
        success: false,
        message: "この書籍は既に登録されています",
        isDuplicate: true,
        notionUrl: "https://notion.so/existing-page",
      };
      const mockFetch = vi.fn().mockResolvedValue(
        createMockResponse(duplicateResponse, 200),
      );

      const result = await registerBook(sampleBookData, {
        loadConfig: createMockLoadConfig(),
        fetchFn: mockFetch,
      });

      expect(result).toEqual(duplicateResponse);
    });

    it("should return validation error response from server (400)", async () => {
      const errorResponse: RegistrationResponse = {
        success: false,
        message: "必須フィールドが欠けています: title",
      };
      const mockFetch = vi.fn().mockResolvedValue(
        createMockResponse(errorResponse, 400),
      );

      const result = await registerBook(sampleBookData, {
        loadConfig: createMockLoadConfig(),
        fetchFn: mockFetch,
      });

      expect(result).toEqual(errorResponse);
    });

    it("should return rate limit error response from server (429)", async () => {
      const errorResponse: RegistrationResponse = {
        success: false,
        message: "Notion APIがビジー状態です。しばらく待ってから再試行してください",
      };
      const mockFetch = vi.fn().mockResolvedValue(
        createMockResponse(errorResponse, 429),
      );

      const result = await registerBook(sampleBookData, {
        loadConfig: createMockLoadConfig(),
        fetchFn: mockFetch,
      });

      expect(result).toEqual(errorResponse);
    });

    it("should return auth error response from server (500)", async () => {
      const errorResponse: RegistrationResponse = {
        success: false,
        message: "Notion認証に失敗しました。環境変数を確認してください",
      };
      const mockFetch = vi.fn().mockResolvedValue(
        createMockResponse(errorResponse, 500),
      );

      const result = await registerBook(sampleBookData, {
        loadConfig: createMockLoadConfig(),
        fetchFn: mockFetch,
      });

      expect(result).toEqual(errorResponse);
    });

    it("should return connection error response from server (503)", async () => {
      const errorResponse: RegistrationResponse = {
        success: false,
        message: "Notionに接続できません。ネットワーク接続を確認してください",
      };
      const mockFetch = vi.fn().mockResolvedValue(
        createMockResponse(errorResponse, 503),
      );

      const result = await registerBook(sampleBookData, {
        loadConfig: createMockLoadConfig(),
        fetchFn: mockFetch,
      });

      expect(result).toEqual(errorResponse);
    });

    it("should handle network error when server is not running", async () => {
      const mockFetch = vi.fn().mockRejectedValue(
        new TypeError("Failed to fetch"),
      );

      const result = await registerBook(sampleBookData, {
        loadConfig: createMockLoadConfig(),
        fetchFn: mockFetch,
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("サーバー");
    });

    it("should handle non-JSON response", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: () => Promise.reject(new SyntaxError("Unexpected token")),
      } as Response;
      const mockFetch = vi.fn().mockResolvedValue(mockResponse);

      const result = await registerBook(sampleBookData, {
        loadConfig: createMockLoadConfig(),
        fetchFn: mockFetch,
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("予期しないレスポンス");
      expect(result.message).toContain("200");
    });

    it("should return config error when loadConfig fails", async () => {
      const mockLoadConfig = vi
        .fn()
        .mockRejectedValue(new Error("storage read failed"));

      const result = await registerBook(sampleBookData, {
        loadConfig: mockLoadConfig,
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("設定");
    });

    it("should handle non-TypeError exceptions during fetch", async () => {
      const mockFetch = vi.fn().mockRejectedValue(
        new Error("AbortError"),
      );

      const result = await registerBook(sampleBookData, {
        loadConfig: createMockLoadConfig(),
        fetchFn: mockFetch,
      });

      expect(result.success).toBe(false);
      expect(result.message).toBeTruthy();
    });
  });

  describe("parseRegistrationResponse", () => {
    it("should parse valid success response", () => {
      const data = {
        success: true,
        message: "書籍を登録しました",
        notionUrl: "https://notion.so/page-id",
      };

      const result = parseRegistrationResponse(data);

      expect(result).toEqual({
        success: true,
        message: "書籍を登録しました",
        notionUrl: "https://notion.so/page-id",
      });
    });

    it("should parse duplicate response with isDuplicate field", () => {
      const data = {
        success: false,
        message: "この書籍は既に登録されています",
        isDuplicate: true,
        notionUrl: "https://notion.so/existing",
      };

      const result = parseRegistrationResponse(data);

      expect(result).toEqual({
        success: false,
        message: "この書籍は既に登録されています",
        isDuplicate: true,
        notionUrl: "https://notion.so/existing",
      });
    });

    it("should parse minimal response without optional fields", () => {
      const data = {
        success: false,
        message: "エラーが発生しました",
      };

      const result = parseRegistrationResponse(data);

      expect(result).toEqual({
        success: false,
        message: "エラーが発生しました",
      });
      expect(result.notionUrl).toBeUndefined();
      expect(result.isDuplicate).toBeUndefined();
    });

    it("should return defaults for non-object data", () => {
      const result = parseRegistrationResponse("not an object");

      expect(result.success).toBe(false);
      expect(result.message).toBeTruthy();
    });

    it("should return defaults for null data", () => {
      const result = parseRegistrationResponse(null);

      expect(result.success).toBe(false);
      expect(result.message).toBeTruthy();
    });

    it("should handle missing success field", () => {
      const data = { message: "some message" };

      const result = parseRegistrationResponse(data);

      expect(result.success).toBe(false);
      expect(result.message).toBe("some message");
    });

    it("should handle missing message field", () => {
      const data = { success: true };

      const result = parseRegistrationResponse(data);

      expect(result.success).toBe(true);
      expect(typeof result.message).toBe("string");
      expect(result.message.length).toBeGreaterThan(0);
    });

    it("should ignore non-string notionUrl", () => {
      const data = {
        success: true,
        message: "OK",
        notionUrl: 123,
      };

      const result = parseRegistrationResponse(data);

      expect(result.notionUrl).toBeUndefined();
    });

    it("should ignore non-boolean isDuplicate", () => {
      const data = {
        success: false,
        message: "error",
        isDuplicate: "yes",
      };

      const result = parseRegistrationResponse(data);

      expect(result.isDuplicate).toBeUndefined();
    });
  });

  describe("isRegisterBookMessage", () => {
    it("should return true for valid REGISTER_BOOK message", () => {
      const message = {
        type: "REGISTER_BOOK",
        bookData: sampleBookData,
      };

      expect(isRegisterBookMessage(message)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isRegisterBookMessage(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isRegisterBookMessage(undefined)).toBe(false);
    });

    it("should return false for wrong message type", () => {
      const message = {
        type: "GET_BOOK_DATA",
        bookData: sampleBookData,
      };

      expect(isRegisterBookMessage(message)).toBe(false);
    });

    it("should return false for missing bookData", () => {
      const message = { type: "REGISTER_BOOK" };

      expect(isRegisterBookMessage(message)).toBe(false);
    });

    it("should return false for null bookData", () => {
      const message = { type: "REGISTER_BOOK", bookData: null };

      expect(isRegisterBookMessage(message)).toBe(false);
    });

    it("should return false for non-object bookData", () => {
      const message = { type: "REGISTER_BOOK", bookData: "string" };

      expect(isRegisterBookMessage(message)).toBe(false);
    });

    it("should return false for primitive values", () => {
      expect(isRegisterBookMessage(42)).toBe(false);
      expect(isRegisterBookMessage("string")).toBe(false);
      expect(isRegisterBookMessage(true)).toBe(false);
    });
  });

  describe("setupMessageListener", () => {
    it("should register a message listener", () => {
      setupMessageListener();

      expect(chromeMock.runtime.onMessage.addListener).toHaveBeenCalledTimes(1);
      expect(chromeMock.runtime.onMessage.addListener).toHaveBeenCalledWith(
        expect.any(Function),
      );
    });

    it("should call registerBook for REGISTER_BOOK message", async () => {
      const serverResponse: RegistrationResponse = {
        success: true,
        message: "書籍を登録しました",
      };
      const mockFetch = vi.fn().mockResolvedValue(
        createMockResponse(serverResponse, 201),
      );

      setupMessageListener({
        loadConfig: createMockLoadConfig(),
        fetchFn: mockFetch,
      });

      const listener = chromeMock.runtime.onMessage.addListener.mock
        .calls[0][0] as (
        message: unknown,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response: RegistrationResponse) => void,
      ) => boolean;

      const sendResponse = vi.fn();
      const result = listener(
        { type: "REGISTER_BOOK", bookData: sampleBookData },
        {} as chrome.runtime.MessageSender,
        sendResponse,
      );

      // Should return true to keep channel open for async response
      expect(result).toBe(true);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(sendResponse).toHaveBeenCalledWith(serverResponse);
    });

    it("should return false for non-REGISTER_BOOK messages", () => {
      setupMessageListener();

      const listener = chromeMock.runtime.onMessage.addListener.mock
        .calls[0][0] as (
        message: unknown,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response: unknown) => void,
      ) => boolean;

      const sendResponse = vi.fn();
      const result = listener(
        { type: "GET_BOOK_DATA" },
        {} as chrome.runtime.MessageSender,
        sendResponse,
      );

      expect(result).toBe(false);
      expect(sendResponse).not.toHaveBeenCalled();
    });

    it("should send error response when loadConfig fails", async () => {
      const mockLoadConfig = vi
        .fn()
        .mockRejectedValue(new Error("storage read failed"));

      setupMessageListener({
        loadConfig: mockLoadConfig,
      });

      const listener = chromeMock.runtime.onMessage.addListener.mock
        .calls[0][0] as (
        message: unknown,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response: RegistrationResponse) => void,
      ) => boolean;

      const sendResponse = vi.fn();
      listener(
        { type: "REGISTER_BOOK", bookData: sampleBookData },
        {} as chrome.runtime.MessageSender,
        sendResponse,
      );

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(sendResponse).toHaveBeenCalledTimes(1);
      const response = sendResponse.mock.calls[0][0] as RegistrationResponse;
      expect(response.success).toBe(false);
      expect(response.message).toContain("設定");
    });
  });
});
