// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import type {
  BookData,
  RegistrationResponse,
  ExtensionConfig,
} from "@techbook-ledger/shared";

/**
 * Extension Integration Tests
 *
 * These tests verify the complete end-to-end flow within the Extension:
 *   Content Script (JSON-LD extract) → Popup (display + action)
 *     → Service Worker (server communication) → Response display
 *
 * Chrome APIs are mocked, fetch is mocked to simulate server responses.
 * Tests verify the full data flow between all Extension components.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7
 */

// --- Chrome API Mock ---
const messageListeners: Array<
  (
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void,
  ) => boolean | undefined
> = [];

const chromeMock = {
  tabs: {
    query: vi.fn(),
    sendMessage: vi.fn(),
  },
  runtime: {
    onMessage: {
      addListener: vi.fn(
        (
          listener: (
            message: unknown,
            sender: chrome.runtime.MessageSender,
            sendResponse: (response: unknown) => void,
          ) => boolean | undefined,
        ) => {
          messageListeners.push(listener);
        },
      ),
    },
    sendMessage: vi.fn(),
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

// Import modules after mocking chrome
const { handleGetBookData } = await import(
  "../../src/content/index.js"
);
const { initPopup } = await import("../../src/popup/popup.js");
const { registerBook } = await import(
  "../../src/background/service-worker.js"
);

// --- Test Data ---
const defaultConfig: ExtensionConfig = {
  serverEndpoint: "http://localhost:3000",
  whitelist: ["amazon.co.jp", "gihyo.jp", "*.amazon.co.jp"],
};

function createMockLoadConfig(
  config: ExtensionConfig = defaultConfig,
): () => Promise<ExtensionConfig> {
  return vi.fn().mockResolvedValue(config);
}

function createMockResponse(body: unknown, status: number = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

function setupPopupDom(): void {
  document.body.innerHTML = `
    <div id="status" class="status"></div>
    <div id="book-info"></div>
    <button id="register-btn" disabled>登録</button>
    <button id="retry-btn" style="display:none">再試行</button>
    <div id="message"></div>
  `;
}

function injectBookJsonLd(bookJsonLd: Record<string, unknown>): void {
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.textContent = JSON.stringify(bookJsonLd);
  document.head.appendChild(script);
}

function createValidBookJsonLd(): Record<string, unknown> {
  return {
    "@type": "Book",
    isbn: "978-4-297-13818-9",
    name: "プロフェッショナルWebプログラミング TypeScript",
    author: { "@type": "Person", name: "山田太郎" },
    publisher: { "@type": "Organization", name: "技術評論社" },
    offers: { price: 3520 },
    datePublished: "2024-03-15",
    numberOfPages: 432,
  };
}

describe("Extension Integration: E2E Registration Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    messageListeners.length = 0;
    document.head.innerHTML = "";
    document.body.innerHTML = "";
  });

  describe("Normal Registration Flow (Req 3.1, 3.4, 3.6)", () => {
    it("should extract book data from JSON-LD and display in popup", async () => {
      // Step 1: Content Script extracts JSON-LD
      injectBookJsonLd(createValidBookJsonLd());
      const contentResponse = handleGetBookData();

      expect(contentResponse.bookData).not.toBeNull();
      expect(contentResponse.bookData!.isbn).toBe("9784297138189");
      expect(contentResponse.bookData!.title).toBe(
        "プロフェッショナルWebプログラミング TypeScript",
      );

      // Step 2: Popup receives book data and displays it
      setupPopupDom();
      const mockGetBookData = vi
        .fn()
        .mockResolvedValue(contentResponse.bookData);
      const mockRegisterBook = vi.fn();
      const mockScheduleReset = vi.fn();

      await initPopup({
        getBookData: mockGetBookData,
        registerBook: mockRegisterBook,
        scheduleReset: mockScheduleReset,
      });

      const status = document.getElementById("status") as HTMLDivElement;
      expect(status.classList.contains("ready")).toBe(true);

      const bookInfo = document.getElementById("book-info") as HTMLDivElement;
      expect(bookInfo.innerHTML).toContain("TypeScript");
      expect(bookInfo.innerHTML).toContain("山田太郎");
      expect(bookInfo.innerHTML).toContain("技術評論社");

      const registerBtn = document.getElementById(
        "register-btn",
      ) as HTMLButtonElement;
      expect(registerBtn.disabled).toBe(false);
    });

    it("should complete full registration flow: extract → display → register → success", async () => {
      // Step 1: Content Script extracts JSON-LD
      injectBookJsonLd(createValidBookJsonLd());
      const contentResponse = handleGetBookData();
      const bookData = contentResponse.bookData!;

      // Step 2: Service Worker sends to server and gets success response
      const serverResponse: RegistrationResponse = {
        success: true,
        message: "書籍を登録しました",
        notionUrl: "https://www.notion.so/new-page",
      };
      const mockFetch = vi
        .fn()
        .mockResolvedValue(createMockResponse(serverResponse, 201));

      const result = await registerBook(bookData, {
        loadConfig: createMockLoadConfig(),
        fetchFn: mockFetch,
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain("登録しました");
      expect(result.notionUrl).toBe("https://www.notion.so/new-page");

      // Step 3: Verify fetch was called correctly
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/books",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bookData),
        },
      );

      // Step 4: Popup displays success
      setupPopupDom();
      const mockGetBookData = vi.fn().mockResolvedValue(bookData);
      const mockRegisterBookFn = vi.fn().mockResolvedValue(result);
      const mockScheduleReset = vi.fn();

      await initPopup({
        getBookData: mockGetBookData,
        registerBook: mockRegisterBookFn,
        scheduleReset: mockScheduleReset,
      });

      const registerBtn = document.getElementById(
        "register-btn",
      ) as HTMLButtonElement;
      registerBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 0));

      const status = document.getElementById("status") as HTMLDivElement;
      expect(status.classList.contains("success")).toBe(true);

      const message = document.getElementById("message") as HTMLDivElement;
      expect(message.textContent).toContain("登録しました");

      // Step 5: Verify reset is scheduled after 3 seconds
      expect(mockScheduleReset).toHaveBeenCalledWith(
        expect.any(Function),
        3000,
      );
    });
  });

  describe("Duplicate Detection Flow (Req 3.2, 3.3)", () => {
    it("should display duplicate notification with existing Notion URL", async () => {
      // Step 1: Content Script extracts book data
      injectBookJsonLd(createValidBookJsonLd());
      const contentResponse = handleGetBookData();
      const bookData = contentResponse.bookData!;

      // Step 2: Service Worker gets duplicate response from server
      const duplicateResponse: RegistrationResponse = {
        success: false,
        message: "この書籍は既に登録されています",
        isDuplicate: true,
        notionUrl: "https://www.notion.so/existing-page",
      };
      const mockFetch = vi
        .fn()
        .mockResolvedValue(createMockResponse(duplicateResponse, 200));

      const result = await registerBook(bookData, {
        loadConfig: createMockLoadConfig(),
        fetchFn: mockFetch,
      });

      expect(result.success).toBe(false);
      expect(result.isDuplicate).toBe(true);
      expect(result.notionUrl).toBe("https://www.notion.so/existing-page");

      // Step 3: Popup displays duplicate result (treated as success state in UI)
      setupPopupDom();
      const mockGetBookData = vi.fn().mockResolvedValue(bookData);
      const mockRegisterBookFn = vi.fn().mockResolvedValue(result);
      const mockScheduleReset = vi.fn();

      await initPopup({
        getBookData: mockGetBookData,
        registerBook: mockRegisterBookFn,
        scheduleReset: mockScheduleReset,
      });

      const registerBtn = document.getElementById(
        "register-btn",
      ) as HTMLButtonElement;
      registerBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 0));

      const status = document.getElementById("status") as HTMLDivElement;
      // isDuplicate is treated as success state in the UI
      expect(status.classList.contains("success")).toBe(true);

      const message = document.getElementById("message") as HTMLDivElement;
      expect(message.textContent).toContain("既に登録されています");
    });
  });

  describe("Error Cases (Req 3.7, 7.1, 7.2, 7.4, 7.5)", () => {
    it("should show inactive state when page has no JSON-LD (Req 7.1)", async () => {
      // Content Script: no JSON-LD on page
      const contentResponse = handleGetBookData();
      expect(contentResponse.bookData).toBeNull();

      // Popup: displays inactive state
      setupPopupDom();
      const mockGetBookData = vi.fn().mockResolvedValue(null);

      await initPopup({ getBookData: mockGetBookData });

      const status = document.getElementById("status") as HTMLDivElement;
      expect(status.classList.contains("inactive")).toBe(true);
      expect(status.textContent).toContain("対応していません");

      const registerBtn = document.getElementById(
        "register-btn",
      ) as HTMLButtonElement;
      expect(registerBtn.disabled).toBe(true);
    });

    it("should show error when book data has missing fields (Req 7.4)", async () => {
      // Content Script: JSON-LD with incomplete data
      injectBookJsonLd({
        "@type": "Book",
        isbn: "978-4-297-13818-9",
        name: "",
        author: "",
      });

      const contentResponse = handleGetBookData();
      const bookData = contentResponse.bookData!;

      // Popup shows missing fields error
      setupPopupDom();
      const mockGetBookData = vi.fn().mockResolvedValue(bookData);

      await initPopup({ getBookData: mockGetBookData });

      const status = document.getElementById("status") as HTMLDivElement;
      expect(status.classList.contains("error")).toBe(true);

      const message = document.getElementById("message") as HTMLDivElement;
      expect(message.textContent).toContain("フィールドが見つかりません");

      const registerBtn = document.getElementById(
        "register-btn",
      ) as HTMLButtonElement;
      expect(registerBtn.disabled).toBe(true);
    });

    it("should show server connection error when server is down (Req 7.2)", async () => {
      injectBookJsonLd(createValidBookJsonLd());
      const contentResponse = handleGetBookData();
      const bookData = contentResponse.bookData!;

      // Service Worker: fetch fails (server not running)
      const mockFetch = vi
        .fn()
        .mockRejectedValue(new TypeError("Failed to fetch"));

      const result = await registerBook(bookData, {
        loadConfig: createMockLoadConfig(),
        fetchFn: mockFetch,
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("サーバー");

      // Popup: shows connection error
      setupPopupDom();
      const mockGetBookData = vi.fn().mockResolvedValue(bookData);
      const mockRegisterBookFn = vi
        .fn()
        .mockRejectedValue(new TypeError("Failed to fetch"));

      await initPopup({
        getBookData: mockGetBookData,
        registerBook: mockRegisterBookFn,
      });

      const registerBtn = document.getElementById(
        "register-btn",
      ) as HTMLButtonElement;
      registerBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 0));

      const status = document.getElementById("status") as HTMLDivElement;
      expect(status.classList.contains("error")).toBe(true);

      // Retry button should be visible (Req 7.5)
      const retryBtn = document.getElementById(
        "retry-btn",
      ) as HTMLButtonElement;
      expect(retryBtn.style.display).not.toBe("none");
    });

    it("should show validation error from server (Req 4.3)", async () => {
      injectBookJsonLd(createValidBookJsonLd());
      const contentResponse = handleGetBookData();
      const bookData = contentResponse.bookData!;

      // Service Worker: server returns validation error
      const validationError: RegistrationResponse = {
        success: false,
        message: "必須フィールドが欠けています: publicationDate",
      };
      const mockFetch = vi
        .fn()
        .mockResolvedValue(createMockResponse(validationError, 400));

      const result = await registerBook(bookData, {
        loadConfig: createMockLoadConfig(),
        fetchFn: mockFetch,
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("必須フィールドが欠けています");
    });

    it("should show Notion auth error from server (Req 5.4)", async () => {
      injectBookJsonLd(createValidBookJsonLd());
      const contentResponse = handleGetBookData();
      const bookData = contentResponse.bookData!;

      // Service Worker: server returns auth error
      const authError: RegistrationResponse = {
        success: false,
        message: "Notion認証に失敗しました。環境変数を確認してください",
      };
      const mockFetch = vi
        .fn()
        .mockResolvedValue(createMockResponse(authError, 500));

      const result = await registerBook(bookData, {
        loadConfig: createMockLoadConfig(),
        fetchFn: mockFetch,
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("認証");
    });

    it("should retry registration when retry button is clicked (Req 7.5)", async () => {
      injectBookJsonLd(createValidBookJsonLd());
      const contentResponse = handleGetBookData();
      const bookData = contentResponse.bookData!;

      const successResponse: RegistrationResponse = {
        success: true,
        message: "書籍を登録しました",
      };

      // Popup: first attempt fails, second succeeds
      setupPopupDom();
      const mockGetBookData = vi.fn().mockResolvedValue(bookData);
      const mockRegisterBookFn = vi
        .fn()
        .mockRejectedValueOnce(new TypeError("Failed to fetch"))
        .mockResolvedValueOnce(successResponse);
      const mockScheduleReset = vi.fn();

      await initPopup({
        getBookData: mockGetBookData,
        registerBook: mockRegisterBookFn,
        scheduleReset: mockScheduleReset,
      });

      // Click register - first attempt fails
      const registerBtn = document.getElementById(
        "register-btn",
      ) as HTMLButtonElement;
      registerBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const retryBtn = document.getElementById(
        "retry-btn",
      ) as HTMLButtonElement;
      expect(retryBtn.style.display).not.toBe("none");

      // Click retry - second attempt succeeds
      retryBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const status = document.getElementById("status") as HTMLDivElement;
      expect(status.classList.contains("success")).toBe(true);
      expect(retryBtn.style.display).toBe("none");
    });

    it("should show rate limit error from server (Req 5.5)", async () => {
      injectBookJsonLd(createValidBookJsonLd());
      const contentResponse = handleGetBookData();
      const bookData = contentResponse.bookData!;

      const rateLimitError: RegistrationResponse = {
        success: false,
        message:
          "Notion APIがビジー状態です。しばらく待ってから再試行してください",
      };
      const mockFetch = vi
        .fn()
        .mockResolvedValue(createMockResponse(rateLimitError, 429));

      const result = await registerBook(bookData, {
        loadConfig: createMockLoadConfig(),
        fetchFn: mockFetch,
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("ビジー");
    });
  });

  describe("Full Data Flow Verification", () => {
    it("should preserve all book fields through the complete extraction pipeline", () => {
      const bookJsonLd = {
        "@type": "Book",
        isbn: "978-4-798-17745-8",
        name: "詳解Rustプログラミング",
        author: [
          { "@type": "Person", name: "Tim McNamara" },
          { "@type": "Person", name: "吉川邦夫" },
        ],
        publisher: { "@type": "Organization", name: "翔泳社" },
        offers: { price: 4180 },
        datePublished: "2022-01-19",
        numberOfPages: 536,
      };

      injectBookJsonLd(bookJsonLd);
      const result = handleGetBookData();
      const bookData = result.bookData!;

      expect(bookData.isbn).toBe("9784798177458");
      expect(bookData.title).toBe("詳解Rustプログラミング");
      expect(bookData.author).toBe("Tim McNamara, 吉川邦夫");
      expect(bookData.publisher).toBe("翔泳社");
      expect(bookData.price).toBe(4180);
      expect(bookData.publicationDate).toBe("2022-01-19");
      expect(bookData.pageCount).toBe(536);
      expect(bookData.sourceUrl).toBe(window.location.href);
    });

    it("should handle @graph wrapper in JSON-LD", () => {
      const jsonLd = {
        "@context": "https://schema.org",
        "@graph": [
          { "@type": "WebPage", name: "Test Page" },
          {
            "@type": "Book",
            isbn: "9784297138189",
            name: "テスト本",
            author: "テスト著者",
            publisher: "テスト出版",
            offers: { price: 1000 },
            datePublished: "2024-01-01",
            numberOfPages: 100,
          },
        ],
      };

      injectBookJsonLd(jsonLd);
      const result = handleGetBookData();

      expect(result.bookData).not.toBeNull();
      expect(result.bookData!.isbn).toBe("9784297138189");
      expect(result.bookData!.title).toBe("テスト本");
    });

    it("should correctly pass extracted data to server registration endpoint", async () => {
      injectBookJsonLd(createValidBookJsonLd());
      const contentResponse = handleGetBookData();
      const bookData = contentResponse.bookData!;

      const mockFetch = vi.fn().mockResolvedValue(
        createMockResponse(
          { success: true, message: "OK", notionUrl: "https://notion.so/x" },
          201,
        ),
      );

      await registerBook(bookData, {
        loadConfig: createMockLoadConfig(),
        fetchFn: mockFetch,
      });

      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("http://localhost:3000/api/books");
      expect(options.method).toBe("POST");
      expect(options.headers).toEqual({
        "Content-Type": "application/json",
      });

      const sentBody = JSON.parse(options.body as string) as BookData;
      expect(sentBody.isbn).toBe("9784297138189");
      expect(sentBody.title).toBe(
        "プロフェッショナルWebプログラミング TypeScript",
      );
      expect(sentBody.author).toBe("山田太郎");
      expect(sentBody.publisher).toBe("技術評論社");
      expect(sentBody.price).toBe(3520);
      expect(sentBody.publicationDate).toBe("2024-03-15");
      expect(sentBody.pageCount).toBe(432);
    });
  });
});
