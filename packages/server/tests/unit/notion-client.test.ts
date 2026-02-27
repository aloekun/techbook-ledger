import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BookData } from "@techbook-ledger/shared";

// Mock @notionhq/client before importing NotionClient
const mockDatabasesQuery = vi.fn();
const mockPagesCreate = vi.fn();

vi.mock("@notionhq/client", () => ({
  Client: vi.fn().mockImplementation(() => ({
    databases: { query: mockDatabasesQuery },
    pages: { create: mockPagesCreate },
  })),
  APIErrorCode: {
    Unauthorized: "unauthorized",
    RateLimited: "rate_limited",
    ServiceUnavailable: "service_unavailable",
    ObjectNotFound: "object_not_found",
  },
  isNotionClientError: (error: unknown): boolean => {
    return error instanceof Error && "code" in error;
  },
}));

import {
  NotionBookClient,
  buildNotionProperties,
  NotionAuthError,
  NotionRateLimitError,
  NotionConnectionError,
} from "../../src/services/notion-client.js";

function createBookData(overrides: Partial<BookData> = {}): BookData {
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

function createNotionError(code: string, status: number): Error {
  const error = new Error(`Notion API error: ${code}`);
  Object.assign(error, { code, status });
  return error;
}

describe("NotionBookClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create an instance with token and databaseId", () => {
      const client = new NotionBookClient({
        token: "secret_test_token",
        databaseId: "test-database-id",
      });
      expect(client).toBeInstanceOf(NotionBookClient);
    });
  });

  describe("queryByIsbn", () => {
    it("should return NotionPage when a matching record exists", async () => {
      const mockPage = {
        id: "page-id-123",
        url: "https://www.notion.so/page-id-123",
      };
      mockDatabasesQuery.mockResolvedValueOnce({
        results: [mockPage],
      });

      const client = new NotionBookClient({
        token: "secret_test",
        databaseId: "db-id",
      });
      const result = await client.queryByIsbn("9784297138189");

      expect(result).toEqual({
        id: "page-id-123",
        url: "https://www.notion.so/page-id-123",
      });
      expect(mockDatabasesQuery).toHaveBeenCalledWith({
        database_id: "db-id",
        filter: {
          property: "ISBN",
          title: {
            equals: "9784297138189",
          },
        },
      });
    });

    it("should return null when no matching record exists", async () => {
      mockDatabasesQuery.mockResolvedValueOnce({
        results: [],
      });

      const client = new NotionBookClient({
        token: "secret_test",
        databaseId: "db-id",
      });
      const result = await client.queryByIsbn("9784297138189");

      expect(result).toBeNull();
    });

    it("should normalize ISBN to lowercase for case-insensitive search", async () => {
      mockDatabasesQuery.mockResolvedValueOnce({
        results: [],
      });

      const client = new NotionBookClient({
        token: "secret_test",
        databaseId: "db-id",
      });
      await client.queryByIsbn("978X123456X");

      expect(mockDatabasesQuery).toHaveBeenCalledWith({
        database_id: "db-id",
        filter: {
          property: "ISBN",
          title: {
            equals: "978x123456x",
          },
        },
      });
    });
  });

  describe("createBookRecord", () => {
    it("should map BookData to Notion properties and create a page", async () => {
      const bookData = createBookData();
      const mockCreatedPage = {
        id: "new-page-id",
        url: "https://www.notion.so/new-page-id",
      };
      mockPagesCreate.mockResolvedValueOnce(mockCreatedPage);

      const client = new NotionBookClient({
        token: "secret_test",
        databaseId: "db-id",
      });
      const url = await client.createBookRecord(bookData);

      expect(url).toBe("https://www.notion.so/new-page-id");
      expect(mockPagesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          parent: { database_id: "db-id" },
          properties: expect.objectContaining({
            ISBN: {
              title: [{ text: { content: "9784297138189" } }],
            },
            タイトル: {
              rich_text: [
                {
                  text: {
                    content:
                      "プロフェッショナルWebプログラミング TypeScript",
                  },
                },
              ],
            },
            著者: {
              rich_text: [{ text: { content: "山田太郎" } }],
            },
            出版社: {
              rich_text: [{ text: { content: "技術評論社" } }],
            },
            価格: {
              number: 3520,
            },
            発売日: {
              date: { start: "2024-03-15" },
            },
            ページ数: {
              number: 432,
            },
            登録元URL: {
              url: "https://gihyo.jp/book/2024/978-4-297-13818-9",
            },
          }),
        }),
      );
    });

    it("should auto-assign registrationDate when creating a record", async () => {
      vi.useFakeTimers();
      const bookData = createBookData();
      const now = new Date("2026-02-28T12:00:00.000Z");
      vi.setSystemTime(now);

      mockPagesCreate.mockResolvedValueOnce({
        id: "new-page-id",
        url: "https://www.notion.so/new-page-id",
      });

      const client = new NotionBookClient({
        token: "secret_test",
        databaseId: "db-id",
      });
      await client.createBookRecord(bookData);

      expect(mockPagesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({
            登録日時: {
              date: { start: "2026-02-28T12:00:00.000Z" },
            },
          }),
        }),
      );
      vi.useRealTimers();
    });
  });

  describe("error handling", () => {
    it("should throw NotionAuthError on unauthorized error", async () => {
      const error = createNotionError("unauthorized", 401);
      mockDatabasesQuery.mockRejectedValueOnce(error);

      const client = new NotionBookClient({
        token: "invalid_token",
        databaseId: "db-id",
      });

      await expect(client.queryByIsbn("9784297138189")).rejects.toThrow(
        NotionAuthError,
      );
    });

    it("should include user-friendly message in NotionAuthError", async () => {
      const error = createNotionError("unauthorized", 401);
      mockDatabasesQuery.mockRejectedValueOnce(error);

      const client = new NotionBookClient({
        token: "invalid_token",
        databaseId: "db-id",
      });

      await expect(client.queryByIsbn("9784297138189")).rejects.toThrow(
        "Notion認証に失敗しました。環境変数を確認してください",
      );
    });

    it("should throw NotionRateLimitError after max retries on rate limit", async () => {
      const error = createNotionError("rate_limited", 429);
      mockDatabasesQuery.mockRejectedValue(error);

      const client = new NotionBookClient({
        token: "secret_test",
        databaseId: "db-id",
        retryDelayMs: 0,
      });

      await expect(client.queryByIsbn("9784297138189")).rejects.toThrow(
        NotionRateLimitError,
      );
      // Initial call + 3 retries = 4 calls total
      expect(mockDatabasesQuery).toHaveBeenCalledTimes(4);
    });

    it("should include user-friendly message in NotionRateLimitError", async () => {
      const error = createNotionError("rate_limited", 429);
      mockDatabasesQuery.mockRejectedValue(error);

      const client = new NotionBookClient({
        token: "secret_test",
        databaseId: "db-id",
        retryDelayMs: 0,
      });

      await expect(client.queryByIsbn("9784297138189")).rejects.toThrow(
        "Notion APIがビジー状態です。しばらく待ってから再試行してください",
      );
    });

    it("should throw NotionConnectionError on network error", async () => {
      const error = new Error("fetch failed");
      mockDatabasesQuery.mockRejectedValueOnce(error);

      const client = new NotionBookClient({
        token: "secret_test",
        databaseId: "db-id",
      });

      await expect(client.queryByIsbn("9784297138189")).rejects.toThrow(
        NotionConnectionError,
      );
    });

    it("should include user-friendly message in NotionConnectionError", async () => {
      const error = new Error("fetch failed");
      mockDatabasesQuery.mockRejectedValueOnce(error);

      const client = new NotionBookClient({
        token: "secret_test",
        databaseId: "db-id",
      });

      await expect(client.queryByIsbn("9784297138189")).rejects.toThrow(
        "Notionに接続できません。ネットワーク接続を確認してください",
      );
    });

    it("should succeed after rate limit retry", async () => {
      const rateLimitError = createNotionError("rate_limited", 429);
      const mockPage = {
        id: "page-id-123",
        url: "https://www.notion.so/page-id-123",
      };

      mockDatabasesQuery
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({ results: [mockPage] });

      const client = new NotionBookClient({
        token: "secret_test",
        databaseId: "db-id",
        retryDelayMs: 0,
      });

      const result = await client.queryByIsbn("9784297138189");

      expect(result).toEqual({
        id: "page-id-123",
        url: "https://www.notion.so/page-id-123",
      });
      expect(mockDatabasesQuery).toHaveBeenCalledTimes(2);
    });

    it("should throw NotionConnectionError on service unavailable error", async () => {
      const error = createNotionError("service_unavailable", 503);
      mockDatabasesQuery.mockRejectedValueOnce(error);

      const client = new NotionBookClient({
        token: "secret_test",
        databaseId: "db-id",
      });

      await expect(client.queryByIsbn("9784297138189")).rejects.toThrow(
        NotionConnectionError,
      );
    });

    it("should propagate errors from createBookRecord as well", async () => {
      const error = createNotionError("unauthorized", 401);
      mockPagesCreate.mockRejectedValueOnce(error);

      const client = new NotionBookClient({
        token: "invalid_token",
        databaseId: "db-id",
      });

      await expect(
        client.createBookRecord(createBookData()),
      ).rejects.toThrow(NotionAuthError);
    });
  });
});

describe("buildNotionProperties", () => {
  it("should map all BookData fields to Notion property format", () => {
    const bookData = createBookData();
    const now = new Date("2026-02-28T12:00:00.000Z");

    const properties = buildNotionProperties(bookData, now);

    expect(properties).toEqual({
      ISBN: {
        title: [{ text: { content: "9784297138189" } }],
      },
      タイトル: {
        rich_text: [
          {
            text: {
              content:
                "プロフェッショナルWebプログラミング TypeScript",
            },
          },
        ],
      },
      著者: {
        rich_text: [{ text: { content: "山田太郎" } }],
      },
      出版社: {
        rich_text: [{ text: { content: "技術評論社" } }],
      },
      価格: {
        number: 3520,
      },
      発売日: {
        date: { start: "2024-03-15" },
      },
      ページ数: {
        number: 432,
      },
      登録元URL: {
        url: "https://gihyo.jp/book/2024/978-4-297-13818-9",
      },
      登録日時: {
        date: { start: "2026-02-28T12:00:00.000Z" },
      },
    });
  });
});
