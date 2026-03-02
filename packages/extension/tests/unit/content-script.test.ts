// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import type { BookData } from "@techbook-ledger/shared";

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
const { setupContentScript, handleGetBookData } = await import(
  "../../src/content/index.js"
);

function createBookJsonLdScript(bookData: Record<string, unknown>): void {
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.textContent = JSON.stringify(bookData);
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

describe("Content Script", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.head.innerHTML = "";
    document.body.innerHTML = "";
  });

  describe("setupContentScript", () => {
    it("should register a message listener", () => {
      setupContentScript();

      expect(chromeMock.runtime.onMessage.addListener).toHaveBeenCalledTimes(1);
      expect(chromeMock.runtime.onMessage.addListener).toHaveBeenCalledWith(
        expect.any(Function),
      );
    });
  });

  describe("handleGetBookData", () => {
    it("should return bookData when valid JSON-LD Book exists on page", () => {
      createBookJsonLdScript(createValidBookJsonLd());

      const result = handleGetBookData();

      expect(result.bookData).not.toBeNull();
      expect(result.bookData!.isbn).toBe("9784297138189");
      expect(result.bookData!.title).toBe(
        "プロフェッショナルWebプログラミング TypeScript",
      );
      expect(result.bookData!.author).toBe("山田太郎");
      expect(result.bookData!.publisher).toBe("技術評論社");
      expect(result.bookData!.price).toBe(3520);
      expect(result.bookData!.publicationDate).toBe("2024-03-15");
      expect(result.bookData!.pageCount).toBe(432);
    });

    it("should set sourceUrl to current page URL", () => {
      createBookJsonLdScript(createValidBookJsonLd());

      const result = handleGetBookData();

      expect(result.bookData!.sourceUrl).toBe(window.location.href);
    });

    it("should return null bookData when no JSON-LD exists", () => {
      const result = handleGetBookData();

      expect(result.bookData).toBeNull();
    });

    it("should return null bookData when JSON-LD has no Book type", () => {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.textContent = JSON.stringify({
        "@type": "WebPage",
        name: "Some Page",
      });
      document.head.appendChild(script);

      const result = handleGetBookData();

      expect(result.bookData).toBeNull();
    });

    it("should return null bookData when Book has no ISBN", () => {
      createBookJsonLdScript({
        "@type": "Book",
        name: "No ISBN Book",
        author: "Author",
      });

      const result = handleGetBookData();

      expect(result.bookData).toBeNull();
    });

    it("should handle multiple JSON-LD blocks and return first valid Book", () => {
      // First: non-Book type
      const script1 = document.createElement("script");
      script1.type = "application/ld+json";
      script1.textContent = JSON.stringify({
        "@type": "WebPage",
        name: "Page",
      });
      document.head.appendChild(script1);

      // Second: valid Book
      createBookJsonLdScript(createValidBookJsonLd());

      const result = handleGetBookData();

      expect(result.bookData).not.toBeNull();
      expect(result.bookData!.isbn).toBe("9784297138189");
    });
  });

  describe("message listener behavior", () => {
    it("should respond with bookData for GET_BOOK_DATA message", () => {
      createBookJsonLdScript(createValidBookJsonLd());
      setupContentScript();

      const listener = chromeMock.runtime.onMessage.addListener.mock
        .calls[0][0] as (
        message: unknown,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response: { bookData: BookData | null }) => void,
      ) => boolean | undefined;

      const sendResponse = vi.fn();
      listener(
        { type: "GET_BOOK_DATA" },
        {} as chrome.runtime.MessageSender,
        sendResponse,
      );

      expect(sendResponse).toHaveBeenCalledTimes(1);
      const response = sendResponse.mock.calls[0][0] as {
        bookData: BookData | null;
      };
      expect(response.bookData).not.toBeNull();
      expect(response.bookData!.isbn).toBe("9784297138189");
    });

    it("should respond with null bookData when no book on page", () => {
      setupContentScript();

      const listener = chromeMock.runtime.onMessage.addListener.mock
        .calls[0][0] as (
        message: unknown,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response: { bookData: BookData | null }) => void,
      ) => boolean | undefined;

      const sendResponse = vi.fn();
      listener(
        { type: "GET_BOOK_DATA" },
        {} as chrome.runtime.MessageSender,
        sendResponse,
      );

      expect(sendResponse).toHaveBeenCalledWith({ bookData: null });
    });

    it("should not respond for non-GET_BOOK_DATA messages", () => {
      setupContentScript();

      const listener = chromeMock.runtime.onMessage.addListener.mock
        .calls[0][0] as (
        message: unknown,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response: unknown) => void,
      ) => boolean | undefined;

      const sendResponse = vi.fn();
      const result = listener(
        { type: "SOME_OTHER_MESSAGE" },
        {} as chrome.runtime.MessageSender,
        sendResponse,
      );

      expect(sendResponse).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it("should not respond for invalid message format", () => {
      setupContentScript();

      const listener = chromeMock.runtime.onMessage.addListener.mock
        .calls[0][0] as (
        message: unknown,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response: unknown) => void,
      ) => boolean | undefined;

      const sendResponse = vi.fn();
      listener(null, {} as chrome.runtime.MessageSender, sendResponse);

      expect(sendResponse).not.toHaveBeenCalled();
    });
  });
});
