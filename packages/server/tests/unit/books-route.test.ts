import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import type { BookData } from "@techbook-ledger/shared";
import {
  NotionAuthError,
  NotionRateLimitError,
  NotionConnectionError,
} from "../../src/services/notion-client.js";
import { createApp } from "../../src/app.js";
import type { BookService } from "../../src/routes/books.js";

const TEST_EXTENSION_ORIGIN = "chrome-extension://abcdefghijklmnop";

function createTestApp(bookService: BookService, allowedOrigins: readonly string[] = [TEST_EXTENSION_ORIGIN]) {
  return createApp({ bookService, allowedOrigins });
}

function createValidBookData(overrides: Partial<BookData> = {}): BookData {
  return {
    isbn: "9784297138189",
    title: "プロフェッショナルWebプログラミング TypeScript",
    author: "山田太郎",
    publisher: "技術評論社",
    price: 3520,
    publicationDate: "2024-03-15",
    pageCount: 432,
    sourceUrl: "https://gihyo.jp/book/2024/978-4-297-13818-9",
    ...overrides,
  };
}

function createMockBookService(
  overrides: Partial<BookService> = {},
): BookService {
  return {
    registerIfAbsent: vi
      .fn()
      .mockResolvedValue({ created: true, notionUrl: "https://www.notion.so/new-page" }),
    ...overrides,
  };
}

describe("POST /api/books", () => {
  let mockService: BookService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockService = createMockBookService();
  });

  describe("successful registration", () => {
    it("should return 201 with success response when book is registered", async () => {
      const app = createTestApp(mockService);
      const bookData = createValidBookData();

      const response = await request(app)
        .post("/api/books")
        .send(bookData)
        .expect(201);

      expect(response.body).toEqual({
        success: true,
        message: "書籍を登録しました",
        notionUrl: "https://www.notion.so/new-page",
      });
    });

    it("should call registerIfAbsent with the book data", async () => {
      const app = createTestApp(mockService);
      const bookData = createValidBookData();

      await request(app).post("/api/books").send(bookData).expect(201);

      expect(mockService.registerIfAbsent).toHaveBeenCalledWith(bookData);
    });
  });

  describe("validation errors", () => {
    it("should return 400 when request body is empty", async () => {
      const app = createTestApp(mockService);

      const response = await request(app)
        .post("/api/books")
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("必須フィールドが欠けています");
    });

    it("should return 400 with missing field names when fields are missing", async () => {
      const app = createTestApp(mockService);

      const response = await request(app)
        .post("/api/books")
        .send({ isbn: "9784297138189", title: "Test" })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("author");
      expect(response.body.message).toContain("publisher");
    });

    it("should return 400 when ISBN format is invalid", async () => {
      const app = createTestApp(mockService);
      const bookData = createValidBookData({ isbn: "abc" });

      const response = await request(app)
        .post("/api/books")
        .send(bookData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("isbn");
    });

    it("should not call registerIfAbsent when validation fails", async () => {
      const app = createTestApp(mockService);

      await request(app).post("/api/books").send({}).expect(400);

      expect(mockService.registerIfAbsent).not.toHaveBeenCalled();
    });
  });

  describe("duplicate detection", () => {
    it("should return 200 with isDuplicate when book already exists", async () => {
      mockService = createMockBookService({
        registerIfAbsent: vi.fn().mockResolvedValue({
          created: false,
          notionUrl: "https://www.notion.so/existing-page",
        }),
      });
      const app = createTestApp(mockService);
      const bookData = createValidBookData();

      const response = await request(app)
        .post("/api/books")
        .send(bookData)
        .expect(200);

      expect(response.body).toEqual({
        success: false,
        message: "この書籍は既に登録されています",
        notionUrl: "https://www.notion.so/existing-page",
        isDuplicate: true,
      });
    });
  });

  describe("Notion API error handling", () => {
    it("should return 500 on NotionAuthError", async () => {
      mockService = createMockBookService({
        registerIfAbsent: vi.fn().mockRejectedValue(
          new NotionAuthError("Notion認証に失敗しました。環境変数を確認してください"),
        ),
      });
      const app = createTestApp(mockService);
      const bookData = createValidBookData();

      const response = await request(app)
        .post("/api/books")
        .send(bookData)
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        message: "Notion認証に失敗しました。環境変数を確認してください",
      });
    });

    it("should return 429 on NotionRateLimitError", async () => {
      mockService = createMockBookService({
        registerIfAbsent: vi.fn().mockRejectedValue(
          new NotionRateLimitError(
            "Notion APIがビジー状態です。しばらく待ってから再試行してください",
          ),
        ),
      });
      const app = createTestApp(mockService);
      const bookData = createValidBookData();

      const response = await request(app)
        .post("/api/books")
        .send(bookData)
        .expect(429);

      expect(response.body).toEqual({
        success: false,
        message:
          "Notion APIがビジー状態です。しばらく待ってから再試行してください",
      });
    });

    it("should return 503 on NotionConnectionError", async () => {
      mockService = createMockBookService({
        registerIfAbsent: vi.fn().mockRejectedValue(
          new NotionConnectionError(
            "Notionに接続できません。ネットワーク接続を確認してください",
          ),
        ),
      });
      const app = createTestApp(mockService);
      const bookData = createValidBookData();

      const response = await request(app)
        .post("/api/books")
        .send(bookData)
        .expect(503);

      expect(response.body).toEqual({
        success: false,
        message:
          "Notionに接続できません。ネットワーク接続を確認してください",
      });
    });

    it("should return 500 on unexpected errors", async () => {
      mockService = createMockBookService({
        registerIfAbsent: vi.fn().mockRejectedValue(new Error("unexpected")),
      });
      const app = createTestApp(mockService);
      const bookData = createValidBookData();

      const response = await request(app)
        .post("/api/books")
        .send(bookData)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("予期しないエラーが発生しました");
    });
  });

  describe("CORS", () => {
    it("should allow requests from an explicitly allowed extension origin", async () => {
      const app = createTestApp(mockService);
      const bookData = createValidBookData();

      const response = await request(app)
        .post("/api/books")
        .set("Origin", TEST_EXTENSION_ORIGIN)
        .send(bookData);

      expect(response.headers["access-control-allow-origin"]).toBe(
        TEST_EXTENSION_ORIGIN,
      );
    });

    it("should reject requests from non-allowed origins", async () => {
      const app = createTestApp(mockService);

      const response = await request(app)
        .post("/api/books")
        .set("Origin", "https://malicious-site.com")
        .send(createValidBookData());

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("許可されていないオリジン");
    });

    it("should reject requests from unlisted extension origins", async () => {
      const app = createTestApp(mockService);

      const response = await request(app)
        .post("/api/books")
        .set("Origin", "chrome-extension://unknownextensionid")
        .send(createValidBookData());

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("許可されていないオリジン");
    });

    it("should allow requests with no origin (server-to-server)", async () => {
      const app = createTestApp(mockService);
      const bookData = createValidBookData();

      const response = await request(app)
        .post("/api/books")
        .send(bookData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });
  });

  describe("request flow", () => {
    it("should follow validate -> registerIfAbsent flow", async () => {
      mockService = createMockBookService();
      const app = createTestApp(mockService);
      const bookData = createValidBookData();

      await request(app).post("/api/books").send(bookData).expect(201);

      expect(mockService.registerIfAbsent).toHaveBeenCalledTimes(1);
      expect(mockService.registerIfAbsent).toHaveBeenCalledWith(bookData);
    });
  });
});

describe("global error handler", () => {
  it("should return 400 for malformed JSON request body", async () => {
    const mockService = createMockBookService();
    const app = createTestApp(mockService);

    const response = await request(app)
      .post("/api/books")
      .set("Content-Type", "application/json")
      .send("{ invalid json }");

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("予期しないエラーが発生しました");
  });

  it("should not call registerIfAbsent for malformed JSON", async () => {
    const mockService = createMockBookService();
    const app = createTestApp(mockService);

    await request(app)
      .post("/api/books")
      .set("Content-Type", "application/json")
      .send("{ invalid json }");

    expect(mockService.registerIfAbsent).not.toHaveBeenCalled();
  });
});

describe("GET /health", () => {
  it("should return status ok", async () => {
    const mockService = createMockBookService();
    const app = createTestApp(mockService);

    const response = await request(app).get("/health").expect(200);

    expect(response.body).toEqual({ status: "ok" });
  });
});
