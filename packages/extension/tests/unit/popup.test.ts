// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import type { BookData, RegistrationResponse } from "@techbook-ledger/shared";

// Mock chrome API
const chromeMock = {
  tabs: {
    query: vi.fn(),
    sendMessage: vi.fn(),
  },
  runtime: {
    sendMessage: vi.fn(),
    lastError: null as chrome.runtime.LastError | null,
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
const { initPopup } = await import("../../src/popup/popup.js");

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

function setupPopupDom(): void {
  document.body.innerHTML = `
    <div id="status" class="status"></div>
    <div id="book-info"></div>
    <button id="register-btn" disabled>登録</button>
    <div id="message"></div>
  `;
}

describe("Popup UI: initPopup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupPopupDom();
  });

  describe("Initial state", () => {
    it("should show inactive state when no book data found", async () => {
      const mockGetBookData = vi.fn().mockResolvedValue(null);
      await initPopup({ getBookData: mockGetBookData });

      const status = document.getElementById("status") as HTMLDivElement;
      expect(status.classList.contains("inactive")).toBe(true);
      expect(status.textContent).toContain("このページは対応していません");

      const btn = document.getElementById("register-btn") as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    it("should show ready state with book info when book data found", async () => {
      const mockGetBookData = vi.fn().mockResolvedValue(sampleBookData);
      await initPopup({ getBookData: mockGetBookData });

      const status = document.getElementById("status") as HTMLDivElement;
      expect(status.classList.contains("ready")).toBe(true);

      const bookInfo = document.getElementById("book-info") as HTMLDivElement;
      expect(bookInfo.innerHTML).toContain("TypeScript入門");
      expect(bookInfo.innerHTML).toContain("鈴木僚太");
    });

    it("should enable register button in ready state", async () => {
      const mockGetBookData = vi.fn().mockResolvedValue(sampleBookData);
      await initPopup({ getBookData: mockGetBookData });

      const btn = document.getElementById("register-btn") as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    });

    it("should display all book fields in book-info area", async () => {
      const mockGetBookData = vi.fn().mockResolvedValue(sampleBookData);
      await initPopup({ getBookData: mockGetBookData });

      const bookInfo = document.getElementById("book-info") as HTMLDivElement;
      expect(bookInfo.innerHTML).toContain("TypeScript入門");
      expect(bookInfo.innerHTML).toContain("鈴木僚太");
      expect(bookInfo.innerHTML).toContain("技術評論社");
      expect(bookInfo.innerHTML).toContain("9784297138189");
      expect(bookInfo.innerHTML).toContain("3,278円");
      expect(bookInfo.innerHTML).toContain("2022-04-22");
      expect(bookInfo.innerHTML).toContain("424");
    });
  });

  describe("Registration flow", () => {
    it("should show loading state when register button clicked", async () => {
      const mockGetBookData = vi.fn().mockResolvedValue(sampleBookData);
      const neverResolve = new Promise<RegistrationResponse>(() => {});
      const mockRegisterBook = vi.fn().mockReturnValue(neverResolve);

      await initPopup({
        getBookData: mockGetBookData,
        registerBook: mockRegisterBook,
      });

      const btn = document.getElementById("register-btn") as HTMLButtonElement;
      btn.click();

      // Let microtask queue process
      await new Promise((resolve) => setTimeout(resolve, 0));

      const status = document.getElementById("status") as HTMLDivElement;
      expect(status.classList.contains("loading")).toBe(true);
    });

    it("should disable button during loading", async () => {
      const mockGetBookData = vi.fn().mockResolvedValue(sampleBookData);
      const neverResolve = new Promise<RegistrationResponse>(() => {});
      const mockRegisterBook = vi.fn().mockReturnValue(neverResolve);

      await initPopup({
        getBookData: mockGetBookData,
        registerBook: mockRegisterBook,
      });

      const btn = document.getElementById("register-btn") as HTMLButtonElement;
      btn.click();

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(btn.disabled).toBe(true);
    });

    it("should call registerBook with bookData", async () => {
      const mockGetBookData = vi.fn().mockResolvedValue(sampleBookData);
      const mockRegisterBook = vi.fn().mockResolvedValue({
        success: true,
        message: "書籍を登録しました",
      } satisfies RegistrationResponse);
      const mockScheduleReset = vi.fn();

      await initPopup({
        getBookData: mockGetBookData,
        registerBook: mockRegisterBook,
        scheduleReset: mockScheduleReset,
      });

      const btn = document.getElementById("register-btn") as HTMLButtonElement;
      btn.click();

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockRegisterBook).toHaveBeenCalledWith(sampleBookData);
    });

    it("should show success state after successful registration", async () => {
      const mockGetBookData = vi.fn().mockResolvedValue(sampleBookData);
      const mockRegisterBook = vi.fn().mockResolvedValue({
        success: true,
        message: "書籍を登録しました",
        notionUrl: "https://notion.so/page-id",
      } satisfies RegistrationResponse);
      const mockScheduleReset = vi.fn();

      await initPopup({
        getBookData: mockGetBookData,
        registerBook: mockRegisterBook,
        scheduleReset: mockScheduleReset,
      });

      const btn = document.getElementById("register-btn") as HTMLButtonElement;
      btn.click();

      await new Promise((resolve) => setTimeout(resolve, 0));

      const status = document.getElementById("status") as HTMLDivElement;
      expect(status.classList.contains("success")).toBe(true);

      const message = document.getElementById("message") as HTMLDivElement;
      expect(message.textContent).toContain("書籍を登録しました");
      expect(message.classList.contains("success")).toBe(true);
    });

    it("should show duplicate message for duplicate registration", async () => {
      const mockGetBookData = vi.fn().mockResolvedValue(sampleBookData);
      const mockRegisterBook = vi.fn().mockResolvedValue({
        success: false,
        message: "この書籍は既に登録されています",
        isDuplicate: true,
        notionUrl: "https://notion.so/existing",
      } satisfies RegistrationResponse);
      const mockScheduleReset = vi.fn();

      await initPopup({
        getBookData: mockGetBookData,
        registerBook: mockRegisterBook,
        scheduleReset: mockScheduleReset,
      });

      const btn = document.getElementById("register-btn") as HTMLButtonElement;
      btn.click();

      await new Promise((resolve) => setTimeout(resolve, 0));

      const status = document.getElementById("status") as HTMLDivElement;
      expect(status.classList.contains("success")).toBe(true);

      const message = document.getElementById("message") as HTMLDivElement;
      expect(message.textContent).toContain("この書籍は既に登録されています");
    });

    it("should show error state on registration failure", async () => {
      const mockGetBookData = vi.fn().mockResolvedValue(sampleBookData);
      const mockRegisterBook = vi.fn().mockResolvedValue({
        success: false,
        message: "サーバーに接続できません",
      } satisfies RegistrationResponse);
      const mockScheduleReset = vi.fn();

      await initPopup({
        getBookData: mockGetBookData,
        registerBook: mockRegisterBook,
        scheduleReset: mockScheduleReset,
      });

      const btn = document.getElementById("register-btn") as HTMLButtonElement;
      btn.click();

      await new Promise((resolve) => setTimeout(resolve, 0));

      const status = document.getElementById("status") as HTMLDivElement;
      expect(status.classList.contains("error")).toBe(true);

      const message = document.getElementById("message") as HTMLDivElement;
      expect(message.textContent).toContain("サーバーに接続できません");
      expect(message.classList.contains("error")).toBe(true);
    });
  });

  describe("Reset after result", () => {
    it("should schedule reset with 3000ms delay", async () => {
      const mockGetBookData = vi.fn().mockResolvedValue(sampleBookData);
      const mockRegisterBook = vi.fn().mockResolvedValue({
        success: true,
        message: "書籍を登録しました",
      } satisfies RegistrationResponse);
      const mockScheduleReset = vi.fn();

      await initPopup({
        getBookData: mockGetBookData,
        registerBook: mockRegisterBook,
        scheduleReset: mockScheduleReset,
      });

      const btn = document.getElementById("register-btn") as HTMLButtonElement;
      btn.click();

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockScheduleReset).toHaveBeenCalledWith(
        expect.any(Function),
        3000,
      );
    });

    it("should reset to ready state when reset fires", async () => {
      const mockGetBookData = vi.fn().mockResolvedValue(sampleBookData);
      const mockRegisterBook = vi.fn().mockResolvedValue({
        success: true,
        message: "書籍を登録しました",
      } satisfies RegistrationResponse);
      let resetCallback: (() => void) | undefined;
      const mockScheduleReset = vi.fn(
        (cb: () => void) => {
          resetCallback = cb;
        },
      );

      await initPopup({
        getBookData: mockGetBookData,
        registerBook: mockRegisterBook,
        scheduleReset: mockScheduleReset,
      });

      const btn = document.getElementById("register-btn") as HTMLButtonElement;
      btn.click();

      await new Promise((resolve) => setTimeout(resolve, 0));

      // Trigger the reset callback
      resetCallback!();

      const status = document.getElementById("status") as HTMLDivElement;
      expect(status.classList.contains("ready")).toBe(true);
    });

    it("should re-enable register button after reset", async () => {
      const mockGetBookData = vi.fn().mockResolvedValue(sampleBookData);
      const mockRegisterBook = vi.fn().mockResolvedValue({
        success: true,
        message: "書籍を登録しました",
      } satisfies RegistrationResponse);
      let resetCallback: (() => void) | undefined;
      const mockScheduleReset = vi.fn(
        (cb: () => void) => {
          resetCallback = cb;
        },
      );

      await initPopup({
        getBookData: mockGetBookData,
        registerBook: mockRegisterBook,
        scheduleReset: mockScheduleReset,
      });

      const btn = document.getElementById("register-btn") as HTMLButtonElement;
      btn.click();

      await new Promise((resolve) => setTimeout(resolve, 0));

      // Button should be disabled after registration
      expect(btn.disabled).toBe(true);

      // Trigger reset
      resetCallback!();

      // Button should be re-enabled
      expect(btn.disabled).toBe(false);
    });
  });

  describe("Edge cases", () => {
    it("should return early when required DOM elements are missing", async () => {
      document.body.innerHTML = "<div>no popup here</div>";
      const mockGetBookData = vi.fn();

      await initPopup({ getBookData: mockGetBookData });

      expect(mockGetBookData).not.toHaveBeenCalled();
    });

    it("should handle getBookData rejection gracefully", async () => {
      const mockGetBookData = vi
        .fn()
        .mockRejectedValue(new Error("tab not found"));

      await initPopup({ getBookData: mockGetBookData });

      const status = document.getElementById("status") as HTMLDivElement;
      expect(status.classList.contains("error")).toBe(true);
      expect(status.textContent).toBeTruthy();
    });

    it("should handle registerBook rejection gracefully", async () => {
      const mockGetBookData = vi.fn().mockResolvedValue(sampleBookData);
      const mockRegisterBook = vi
        .fn()
        .mockRejectedValue(new Error("network error"));
      const mockScheduleReset = vi.fn();

      await initPopup({
        getBookData: mockGetBookData,
        registerBook: mockRegisterBook,
        scheduleReset: mockScheduleReset,
      });

      const btn = document.getElementById("register-btn") as HTMLButtonElement;
      btn.click();

      await new Promise((resolve) => setTimeout(resolve, 0));

      const status = document.getElementById("status") as HTMLDivElement;
      expect(status.classList.contains("error")).toBe(true);

      const message = document.getElementById("message") as HTMLDivElement;
      expect(message.textContent).toBeTruthy();
      expect(message.classList.contains("error")).toBe(true);
    });
  });
});
