import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import fc from "fast-check";
import type { BookData } from "@techbook-ledger/shared";
import { createApp } from "../../src/app.js";
import type { BookService } from "../../src/routes/books.js";

function createTestApp(bookService: BookService) {
  return createApp({ bookService, allowedOrigins: ["chrome-extension://test"] });
}

// BookData arbitrary generator
const bookDataArb: fc.Arbitrary<BookData> = fc.record({
  isbn: fc.oneof(
    fc.stringOf(
      fc.constantFrom("0", "1", "2", "3", "4", "5", "6", "7", "8", "9"),
      { minLength: 10, maxLength: 10 },
    ),
    fc.stringOf(
      fc.constantFrom("0", "1", "2", "3", "4", "5", "6", "7", "8", "9"),
      { minLength: 13, maxLength: 13 },
    ),
  ),
  title: fc.string({ minLength: 1, maxLength: 100 }),
  author: fc.string({ minLength: 1, maxLength: 50 }),
  publisher: fc.string({ minLength: 1, maxLength: 50 }),
  price: fc.integer({ min: 1, max: 100000 }),
  publicationDate: fc
    .date({
      min: new Date("1900-01-01"),
      max: new Date("2100-12-31"),
    })
    .map((d) => d.toISOString().split("T")[0]),
  pageCount: fc.integer({ min: 1, max: 10000 }),
  sourceUrl: fc
    .webUrl({ withFragments: false, withQueryParameters: false })
    .filter((url) => url.length > 0),
});

// Notion URL arbitrary generator
const notionUrlArb = fc
  .uuid()
  .map((id) => `https://www.notion.so/${id}`);

describe("Feature: tech-book-decision-support, Property 10: 新規レコードの作成", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 201 for all BookData when registerIfAbsent returns created: true", async () => {
    await fc.assert(
      fc.asyncProperty(bookDataArb, notionUrlArb, async (bookData, notionUrl) => {
        const registerIfAbsent = vi.fn().mockResolvedValue({ created: true, notionUrl });
        const mockService: BookService = { registerIfAbsent };
        const app = createTestApp(mockService);

        const response = await request(app)
          .post("/api/books")
          .send(bookData);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.notionUrl).toBe(notionUrl);
        expect(registerIfAbsent).toHaveBeenCalledTimes(1);
        expect(registerIfAbsent).toHaveBeenCalledWith(bookData);
      }),
      { numRuns: 100 },
    );
  });

  it("should return 200 with isDuplicate when registerIfAbsent returns created: false", async () => {
    await fc.assert(
      fc.asyncProperty(bookDataArb, notionUrlArb, async (bookData, existingUrl) => {
        const registerIfAbsent = vi.fn().mockResolvedValue({ created: false, notionUrl: existingUrl });
        const mockService: BookService = { registerIfAbsent };
        const app = createTestApp(mockService);

        const response = await request(app)
          .post("/api/books")
          .send(bookData);

        expect(response.status).toBe(200);
        expect(response.body.isDuplicate).toBe(true);
        expect(response.body.notionUrl).toBe(existingUrl);
      }),
      { numRuns: 100 },
    );
  });
});

describe("Feature: tech-book-decision-support, Property 11: タイムスタンプの自動付与", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should pass BookData to registerIfAbsent which auto-assigns timestamp internally", async () => {
    await fc.assert(
      fc.asyncProperty(bookDataArb, async (bookData) => {
        let capturedBookData: BookData | undefined;
        const mockService: BookService = {
          registerIfAbsent: vi.fn().mockImplementation(async (data: BookData) => {
            capturedBookData = data;
            return { created: true, notionUrl: "https://www.notion.so/new-page" };
          }),
        };
        const app = createTestApp(mockService);

        const response = await request(app)
          .post("/api/books")
          .send(bookData);

        expect(response.status).toBe(201);
        expect(capturedBookData).toBeDefined();
        expect(capturedBookData).toEqual(bookData);
        expect(capturedBookData).not.toHaveProperty("registrationDate");
      }),
      { numRuns: 100 },
    );
  });
});

describe("Feature: tech-book-decision-support, Property 13: 認証情報の非露出", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Test that successful responses don't contain auth info
  it("should not include Notion token or database ID in successful responses", async () => {
    await fc.assert(
      fc.asyncProperty(bookDataArb, async (bookData) => {
        const mockService: BookService = {
          registerIfAbsent: vi
            .fn()
            .mockResolvedValue({ created: true, notionUrl: "https://www.notion.so/new-page" }),
        };
        const app = createTestApp(mockService);

        const response = await request(app)
          .post("/api/books")
          .send(bookData);

        const responseText = JSON.stringify(response.body);
        expect(responseText).not.toContain("secret_");
        expect(responseText).not.toContain("ntn_");
        expect(responseText).not.toContain("NOTION_TOKEN");
        expect(responseText).not.toContain("NOTION_DATABASE_ID");
        expect(responseText).not.toContain("notionToken");
        expect(responseText).not.toContain("notionDatabaseId");
        expect(responseText).not.toContain("databaseId");
      }),
      { numRuns: 100 },
    );
  });

  // Test that duplicate responses don't contain auth info
  it("should not include Notion credentials in duplicate detection responses", async () => {
    await fc.assert(
      fc.asyncProperty(bookDataArb, async (bookData) => {
        const mockService: BookService = {
          registerIfAbsent: vi.fn().mockResolvedValue({
            created: false,
            notionUrl: "https://www.notion.so/page-id",
          }),
        };
        const app = createTestApp(mockService);

        const response = await request(app)
          .post("/api/books")
          .send(bookData);

        const responseText = JSON.stringify(response.body);
        expect(responseText).not.toContain("secret_");
        expect(responseText).not.toContain("ntn_");
        expect(responseText).not.toContain("NOTION_TOKEN");
        expect(responseText).not.toContain("NOTION_DATABASE_ID");
        expect(responseText).not.toContain("notionToken");
        expect(responseText).not.toContain("notionDatabaseId");
        expect(responseText).not.toContain("databaseId");
      }),
      { numRuns: 100 },
    );
  });

  // Test that error responses don't contain auth info
  it("should not include Notion credentials in error responses", async () => {
    const errorTypes = [
      new Error("Notion認証に失敗しました。環境変数を確認してください"),
      new Error("Notion APIがビジー状態です"),
      new Error("Notionに接続できません"),
    ];

    for (const error of errorTypes) {
      const mockService: BookService = {
        registerIfAbsent: vi.fn().mockRejectedValue(error),
      };
      const app = createTestApp(mockService);

      const bookData: BookData = {
        isbn: "9784297138189",
        title: "テスト本",
        author: "著者",
        publisher: "出版社",
        price: 1000,
        publicationDate: "2024-01-01",
        pageCount: 100,
        sourceUrl: "https://example.com",
      };

      const response = await request(app)
        .post("/api/books")
        .send(bookData);

      const responseText = JSON.stringify(response.body);
      expect(responseText).not.toContain("secret_");
      expect(responseText).not.toContain("ntn_");
      expect(responseText).not.toContain("NOTION_TOKEN");
      expect(responseText).not.toContain("NOTION_DATABASE_ID");
      expect(responseText).not.toContain("notionToken");
      expect(responseText).not.toContain("notionDatabaseId");
    }
  });
});
