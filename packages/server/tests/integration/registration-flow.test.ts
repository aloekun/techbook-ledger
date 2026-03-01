import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import type { BookData, RegistrationResponse } from "@techbook-ledger/shared";
import { createApp } from "../../src/app.js";
import type { NotionPage } from "../../src/services/notion-client.js";

/**
 * Server Integration Tests
 *
 * These tests verify the complete end-to-end flow through the Express server:
 *   Request → Validation → Duplicate Check → Notion Registration → Response
 *
 * Notion API is mocked, but all other components are real:
 *   - Express middleware (CORS, JSON parsing)
 *   - Request validator
 *   - Books route handler
 *   - ISBN lock mechanism
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7
 */

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

interface MockNotionState {
  existingPages: Map<string, NotionPage>;
  createdPages: Map<string, { bookData: BookData; url: string }>;
  shouldFailWithAuth: boolean;
  shouldFailWithRateLimit: boolean;
  shouldFailWithConnection: boolean;
}

function createMockNotionState(): MockNotionState {
  return {
    existingPages: new Map(),
    createdPages: new Map(),
    shouldFailWithAuth: false,
    shouldFailWithRateLimit: false,
    shouldFailWithConnection: false,
  };
}

function createMockBookService(state: MockNotionState) {
  return {
    registerIfAbsent: vi.fn(async (bookData: BookData) => {
      if (state.shouldFailWithAuth) {
        const { NotionAuthError } = await import(
          "../../src/services/notion-client.js"
        );
        throw new NotionAuthError(
          "Notion認証に失敗しました。環境変数を確認してください",
        );
      }
      if (state.shouldFailWithRateLimit) {
        const { NotionRateLimitError } = await import(
          "../../src/services/notion-client.js"
        );
        throw new NotionRateLimitError(
          "Notion APIがビジー状態です。しばらく待ってから再試行してください",
        );
      }
      if (state.shouldFailWithConnection) {
        const { NotionConnectionError } = await import(
          "../../src/services/notion-client.js"
        );
        throw new NotionConnectionError(
          "Notionに接続できません。ネットワーク接続を確認してください",
        );
      }

      const normalizedIsbn = bookData.isbn.toLowerCase();
      const existing = state.existingPages.get(normalizedIsbn);
      if (existing) {
        return { created: false as const, notionUrl: existing.url };
      }

      const notionUrl = `https://www.notion.so/page-${normalizedIsbn}`;
      state.existingPages.set(normalizedIsbn, {
        id: `page-id-${normalizedIsbn}`,
        url: notionUrl,
      });
      state.createdPages.set(normalizedIsbn, { bookData, url: notionUrl });

      return { created: true as const, notionUrl };
    }),
  };
}

const TEST_EXTENSION_ORIGIN = "chrome-extension://abcdefghijklmnop";

describe("Server Integration: Registration Flow", () => {
  let notionState: MockNotionState;

  beforeEach(() => {
    vi.clearAllMocks();
    notionState = createMockNotionState();
  });

  describe("Normal Registration Flow (Req 3.1, 3.4, 3.5, 3.6)", () => {
    it("should successfully register a new book through the full flow", async () => {
      const service = createMockBookService(notionState);
      const app = createApp({
        bookService: service,
        allowedOrigins: [TEST_EXTENSION_ORIGIN],
      });
      const bookData = createValidBookData();

      const response = await request(app)
        .post("/api/books")
        .set("Origin", TEST_EXTENSION_ORIGIN)
        .send(bookData)
        .expect("Content-Type", /json/)
        .expect(201);

      const body: RegistrationResponse = response.body;
      expect(body.success).toBe(true);
      expect(body.message).toContain("登録しました");
      expect(body.notionUrl).toBeTruthy();
    });

    it("should pass the complete book data to the service", async () => {
      const service = createMockBookService(notionState);
      const app = createApp({
        bookService: service,
        allowedOrigins: [TEST_EXTENSION_ORIGIN],
      });
      const bookData = createValidBookData();

      await request(app)
        .post("/api/books")
        .send(bookData)
        .expect(201);

      expect(service.registerIfAbsent).toHaveBeenCalledWith(bookData);
    });

    it("should include notionUrl in response for newly created book", async () => {
      const service = createMockBookService(notionState);
      const app = createApp({
        bookService: service,
        allowedOrigins: [TEST_EXTENSION_ORIGIN],
      });

      const response = await request(app)
        .post("/api/books")
        .send(createValidBookData())
        .expect(201);

      expect(response.body.notionUrl).toMatch(/^https:\/\/www\.notion\.so\//);
    });

    it("should allow CORS for registered extension origins", async () => {
      const service = createMockBookService(notionState);
      const app = createApp({
        bookService: service,
        allowedOrigins: [TEST_EXTENSION_ORIGIN],
      });

      const response = await request(app)
        .post("/api/books")
        .set("Origin", TEST_EXTENSION_ORIGIN)
        .send(createValidBookData())
        .expect(201);

      expect(response.headers["access-control-allow-origin"]).toBe(
        TEST_EXTENSION_ORIGIN,
      );
    });
  });

  describe("Duplicate Detection Flow (Req 3.2, 3.3)", () => {
    it("should detect duplicate when same ISBN is registered twice", async () => {
      const service = createMockBookService(notionState);
      const app = createApp({
        bookService: service,
        allowedOrigins: [TEST_EXTENSION_ORIGIN],
      });
      const bookData = createValidBookData();

      // First registration
      const firstResponse = await request(app)
        .post("/api/books")
        .send(bookData)
        .expect(201);

      expect(firstResponse.body.success).toBe(true);

      // Second registration with same ISBN
      const secondResponse = await request(app)
        .post("/api/books")
        .send(bookData)
        .expect(200);

      const body: RegistrationResponse = secondResponse.body;
      expect(body.success).toBe(false);
      expect(body.isDuplicate).toBe(true);
      expect(body.message).toContain("既に登録されています");
      expect(body.notionUrl).toBeTruthy();
    });

    it("should return existing Notion URL for duplicate books", async () => {
      const service = createMockBookService(notionState);
      const app = createApp({
        bookService: service,
        allowedOrigins: [TEST_EXTENSION_ORIGIN],
      });
      const bookData = createValidBookData();

      // Register first
      const firstResponse = await request(app)
        .post("/api/books")
        .send(bookData)
        .expect(201);

      const firstUrl = firstResponse.body.notionUrl;

      // Try to register duplicate
      const secondResponse = await request(app)
        .post("/api/books")
        .send(bookData)
        .expect(200);

      expect(secondResponse.body.notionUrl).toBe(firstUrl);
    });

    it("should allow different ISBNs to be registered independently", async () => {
      const service = createMockBookService(notionState);
      const app = createApp({
        bookService: service,
        allowedOrigins: [TEST_EXTENSION_ORIGIN],
      });

      const book1 = createValidBookData({ isbn: "9784297138189" });
      const book2 = createValidBookData({
        isbn: "9784798177458",
        title: "別の書籍",
      });

      const response1 = await request(app)
        .post("/api/books")
        .send(book1)
        .expect(201);

      const response2 = await request(app)
        .post("/api/books")
        .send(book2)
        .expect(201);

      expect(response1.body.success).toBe(true);
      expect(response2.body.success).toBe(true);
      expect(response1.body.notionUrl).not.toBe(response2.body.notionUrl);
    });
  });

  describe("Validation Error Flow (Req 4.3)", () => {
    it("should reject request with missing required fields", async () => {
      const service = createMockBookService(notionState);
      const app = createApp({
        bookService: service,
        allowedOrigins: [TEST_EXTENSION_ORIGIN],
      });

      const response = await request(app)
        .post("/api/books")
        .send({ isbn: "9784297138189" })
        .expect(400);

      const body: RegistrationResponse = response.body;
      expect(body.success).toBe(false);
      expect(body.message).toContain("必須フィールドが欠けています");
      expect(service.registerIfAbsent).not.toHaveBeenCalled();
    });

    it("should reject request with invalid ISBN format", async () => {
      const service = createMockBookService(notionState);
      const app = createApp({
        bookService: service,
        allowedOrigins: [TEST_EXTENSION_ORIGIN],
      });

      const bookData = createValidBookData({ isbn: "invalid-isbn" });

      const response = await request(app)
        .post("/api/books")
        .send(bookData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("isbn");
    });

    it("should reject empty request body", async () => {
      const service = createMockBookService(notionState);
      const app = createApp({
        bookService: service,
        allowedOrigins: [TEST_EXTENSION_ORIGIN],
      });

      const response = await request(app)
        .post("/api/books")
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it("should list all missing field names in error message", async () => {
      const service = createMockBookService(notionState);
      const app = createApp({
        bookService: service,
        allowedOrigins: [TEST_EXTENSION_ORIGIN],
      });

      const partialData = {
        isbn: "9784297138189",
        title: "Test Book",
      };

      const response = await request(app)
        .post("/api/books")
        .send(partialData)
        .expect(400);

      expect(response.body.message).toContain("author");
      expect(response.body.message).toContain("publisher");
      expect(response.body.message).toContain("publicationDate");
      expect(response.body.message).toContain("sourceUrl");
      expect(response.body.message).toContain("price");
      expect(response.body.message).toContain("pageCount");
    });
  });

  describe("Notion API Error Flow", () => {
    it("should return 500 with friendly message on authentication error", async () => {
      notionState.shouldFailWithAuth = true;
      const service = createMockBookService(notionState);
      const app = createApp({
        bookService: service,
        allowedOrigins: [TEST_EXTENSION_ORIGIN],
      });

      const response = await request(app)
        .post("/api/books")
        .send(createValidBookData())
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("認証");
    });

    it("should return 429 on Notion rate limit", async () => {
      notionState.shouldFailWithRateLimit = true;
      const service = createMockBookService(notionState);
      const app = createApp({
        bookService: service,
        allowedOrigins: [TEST_EXTENSION_ORIGIN],
      });

      const response = await request(app)
        .post("/api/books")
        .send(createValidBookData())
        .expect(429);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("ビジー");
    });

    it("should return 503 on Notion connection error", async () => {
      notionState.shouldFailWithConnection = true;
      const service = createMockBookService(notionState);
      const app = createApp({
        bookService: service,
        allowedOrigins: [TEST_EXTENSION_ORIGIN],
      });

      const response = await request(app)
        .post("/api/books")
        .send(createValidBookData())
        .expect(503);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("接続");
    });

    it("should not expose Notion credentials in any error response", async () => {
      notionState.shouldFailWithAuth = true;
      const service = createMockBookService(notionState);
      const app = createApp({
        bookService: service,
        allowedOrigins: [TEST_EXTENSION_ORIGIN],
      });

      const response = await request(app)
        .post("/api/books")
        .send(createValidBookData())
        .expect(500);

      const body = JSON.stringify(response.body);
      expect(body).not.toContain("secret_");
      expect(body).not.toContain("NOTION_TOKEN");
      expect(body).not.toContain("NOTION_DATABASE_ID");
    });
  });

  describe("CORS Security (Req 4.2, 8.3)", () => {
    it("should reject requests from unauthorized origins", async () => {
      const service = createMockBookService(notionState);
      const app = createApp({
        bookService: service,
        allowedOrigins: [TEST_EXTENSION_ORIGIN],
      });

      const response = await request(app)
        .post("/api/books")
        .set("Origin", "https://evil-site.com")
        .send(createValidBookData());

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("許可されていないオリジン");
    });

    it("should set correct CORS headers for preflight requests", async () => {
      const service = createMockBookService(notionState);
      const app = createApp({
        bookService: service,
        allowedOrigins: [TEST_EXTENSION_ORIGIN],
      });

      const response = await request(app)
        .options("/api/books")
        .set("Origin", TEST_EXTENSION_ORIGIN)
        .set("Access-Control-Request-Method", "POST");

      expect(response.headers["access-control-allow-origin"]).toBe(
        TEST_EXTENSION_ORIGIN,
      );
    });
  });

  describe("Health Check", () => {
    it("should return ok status on health endpoint", async () => {
      const service = createMockBookService(notionState);
      const app = createApp({
        bookService: service,
        allowedOrigins: [TEST_EXTENSION_ORIGIN],
      });

      const response = await request(app)
        .get("/health")
        .expect(200);

      expect(response.body).toEqual({ status: "ok" });
    });
  });
});
