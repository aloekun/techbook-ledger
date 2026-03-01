import { describe, it, expect } from "vitest";
import type { BookData, RegistrationResponse } from "@techbook-ledger/shared";
import {
  createInitialState,
  derivePopupState,
  createLoadingState,
  createResultState,
  createResetState,
  formatPrice,
  formatBookInfoHtml,
  escapeHtml,
} from "../../src/popup/popup-state.js";

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

describe("createInitialState", () => {
  it("should return inactive state with null bookData", () => {
    const state = createInitialState();
    expect(state.status).toBe("inactive");
    expect(state.bookData).toBeNull();
    expect(state.message).toBe("");
  });
});

describe("derivePopupState", () => {
  it("should return inactive state when bookData is null", () => {
    const state = derivePopupState(null);
    expect(state.status).toBe("inactive");
    expect(state.bookData).toBeNull();
    expect(state.message).toBe("このページは対応していません");
  });

  it("should return ready state when bookData is provided", () => {
    const state = derivePopupState(sampleBookData);
    expect(state.status).toBe("ready");
    expect(state.bookData).toEqual(sampleBookData);
    expect(state.message).toBe("");
  });

  it("should not mutate the input bookData", () => {
    const original = { ...sampleBookData };
    derivePopupState(sampleBookData);
    expect(sampleBookData).toEqual(original);
  });

  it("should return error state when title is missing", () => {
    const data: BookData = { ...sampleBookData, title: "" };
    const state = derivePopupState(data);
    expect(state.status).toBe("error");
    expect(state.bookData).toEqual(data);
    expect(state.message).toContain("タイトル");
    expect(state.message).toContain("次のフィールドが見つかりません");
  });

  it("should return error state when multiple fields are missing", () => {
    const data: BookData = {
      ...sampleBookData,
      title: "",
      author: "",
      price: 0,
    };
    const state = derivePopupState(data);
    expect(state.status).toBe("error");
    expect(state.message).toContain("タイトル");
    expect(state.message).toContain("著者");
    expect(state.message).toContain("価格");
  });

  it("should return error state when pageCount is zero", () => {
    const data: BookData = { ...sampleBookData, pageCount: 0 };
    const state = derivePopupState(data);
    expect(state.status).toBe("error");
    expect(state.message).toContain("ページ数");
  });

  it("should keep bookData in error state for missing fields", () => {
    const data: BookData = { ...sampleBookData, author: "" };
    const state = derivePopupState(data);
    expect(state.bookData).toEqual(data);
  });
});

describe("createLoadingState", () => {
  it("should return loading state with bookData", () => {
    const state = createLoadingState(sampleBookData);
    expect(state.status).toBe("loading");
    expect(state.bookData).toEqual(sampleBookData);
    expect(state.message).toBe("");
  });
});

describe("createResultState", () => {
  it("should return success state on successful registration", () => {
    const response: RegistrationResponse = {
      success: true,
      message: "書籍を登録しました",
      notionUrl: "https://notion.so/page-id",
    };
    const state = createResultState(sampleBookData, response);
    expect(state.status).toBe("success");
    expect(state.bookData).toEqual(sampleBookData);
    expect(state.message).toBe("書籍を登録しました");
  });

  it("should return success state with duplicate message on duplicate", () => {
    const response: RegistrationResponse = {
      success: false,
      message: "この書籍は既に登録されています",
      isDuplicate: true,
      notionUrl: "https://notion.so/existing-page",
    };
    const state = createResultState(sampleBookData, response);
    expect(state.status).toBe("success");
    expect(state.message).toBe("この書籍は既に登録されています");
  });

  it("should return error state on failed registration", () => {
    const response: RegistrationResponse = {
      success: false,
      message: "サーバーに接続できません",
    };
    const state = createResultState(sampleBookData, response);
    expect(state.status).toBe("error");
    expect(state.bookData).toEqual(sampleBookData);
    expect(state.message).toBe("サーバーに接続できません");
  });

  it("should include notionUrl in message when provided on success", () => {
    const response: RegistrationResponse = {
      success: true,
      message: "書籍を登録しました",
      notionUrl: "https://notion.so/page-id",
    };
    const state = createResultState(sampleBookData, response);
    expect(state.message).toContain("書籍を登録しました");
  });
});

describe("createResetState", () => {
  it("should return ready state with bookData", () => {
    const state = createResetState(sampleBookData);
    expect(state.status).toBe("ready");
    expect(state.bookData).toEqual(sampleBookData);
    expect(state.message).toBe("");
  });
});

describe("formatPrice", () => {
  it("should return '0円' for zero", () => {
    expect(formatPrice(0)).toBe("0円");
  });

  it("should format with comma separators", () => {
    expect(formatPrice(3278)).toBe("3,278円");
  });

  it("should handle large numbers", () => {
    expect(formatPrice(15000)).toBe("15,000円");
  });

  it("should handle very large numbers", () => {
    expect(formatPrice(1234567)).toBe("1,234,567円");
  });

  it("should handle small numbers without comma", () => {
    expect(formatPrice(100)).toBe("100円");
  });
});

describe("escapeHtml", () => {
  it("should escape ampersand", () => {
    expect(escapeHtml("a&b")).toBe("a&amp;b");
  });

  it("should escape angle brackets", () => {
    expect(escapeHtml("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;",
    );
  });

  it("should escape double quotes", () => {
    expect(escapeHtml('a"b')).toBe("a&quot;b");
  });

  it("should escape single quotes", () => {
    expect(escapeHtml("a'b")).toBe("a&#39;b");
  });

  it("should return plain text unchanged", () => {
    expect(escapeHtml("TypeScript入門")).toBe("TypeScript入門");
  });
});

describe("formatBookInfoHtml", () => {
  it("should include book title", () => {
    const html = formatBookInfoHtml(sampleBookData);
    expect(html).toContain("TypeScript入門");
  });

  it("should include author", () => {
    const html = formatBookInfoHtml(sampleBookData);
    expect(html).toContain("鈴木僚太");
  });

  it("should include publisher", () => {
    const html = formatBookInfoHtml(sampleBookData);
    expect(html).toContain("技術評論社");
  });

  it("should include ISBN", () => {
    const html = formatBookInfoHtml(sampleBookData);
    expect(html).toContain("9784297138189");
  });

  it("should include formatted price", () => {
    const html = formatBookInfoHtml(sampleBookData);
    expect(html).toContain("3,278円");
  });

  it("should include publication date", () => {
    const html = formatBookInfoHtml(sampleBookData);
    expect(html).toContain("2022-04-22");
  });

  it("should include page count", () => {
    const html = formatBookInfoHtml(sampleBookData);
    expect(html).toContain("424");
  });

  it("should escape HTML in book fields to prevent XSS", () => {
    const malicious: BookData = {
      isbn: "1234567890",
      title: '<script>alert("xss")</script>',
      author: "a&b<c>",
      publisher: "O'Reilly",
      price: 0,
      publicationDate: "",
      pageCount: 0,
      sourceUrl: "https://example.com",
    };
    const html = formatBookInfoHtml(malicious);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("a&amp;b&lt;c&gt;");
    expect(html).toContain("O&#39;Reilly");
  });

  it("should handle empty optional fields gracefully", () => {
    const minimal: BookData = {
      isbn: "1234567890",
      title: "Test",
      author: "",
      publisher: "",
      price: 0,
      publicationDate: "",
      pageCount: 0,
      sourceUrl: "https://example.com",
    };
    const html = formatBookInfoHtml(minimal);
    expect(html).toContain("Test");
    expect(html).toContain("1234567890");
  });
});
