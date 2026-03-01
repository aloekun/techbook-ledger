import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BookData } from "@techbook-ledger/shared";

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

import { NotionBookClient } from "../../src/services/notion-client.js";

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

function createClient(): NotionBookClient {
  return new NotionBookClient({
    token: "secret_test",
    databaseId: "db-id",
    retryDelayMs: 0,
  });
}

describe("NotionBookClient.registerIfAbsent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a new record when ISBN does not exist", async () => {
    mockDatabasesQuery.mockResolvedValueOnce({ results: [] });
    mockPagesCreate.mockResolvedValueOnce({
      id: "new-page-id",
      url: "https://www.notion.so/new-page-id",
    });

    const client = createClient();
    const result = await client.registerIfAbsent(createBookData());

    expect(result).toEqual({
      created: true,
      notionUrl: "https://www.notion.so/new-page-id",
    });
    expect(mockDatabasesQuery).toHaveBeenCalledTimes(1);
    expect(mockPagesCreate).toHaveBeenCalledTimes(1);
  });

  it("should return existing record when ISBN already exists", async () => {
    mockDatabasesQuery.mockResolvedValueOnce({
      results: [
        {
          id: "existing-page-id",
          url: "https://www.notion.so/existing-page-id",
        },
      ],
    });

    const client = createClient();
    const result = await client.registerIfAbsent(createBookData());

    expect(result).toEqual({
      created: false,
      notionUrl: "https://www.notion.so/existing-page-id",
    });
    expect(mockDatabasesQuery).toHaveBeenCalledTimes(1);
    expect(mockPagesCreate).not.toHaveBeenCalled();
  });

  it("should propagate query errors", async () => {
    const error = new Error("Notion API error: unauthorized");
    Object.assign(error, { code: "unauthorized", status: 401 });
    mockDatabasesQuery.mockRejectedValueOnce(error);

    const client = createClient();

    await expect(client.registerIfAbsent(createBookData())).rejects.toThrow(
      "Notion認証に失敗しました",
    );
  });

  it("should propagate create errors", async () => {
    mockDatabasesQuery.mockResolvedValueOnce({ results: [] });

    const error = new Error("Notion API error: service_unavailable");
    Object.assign(error, { code: "service_unavailable", status: 503 });
    mockPagesCreate.mockRejectedValueOnce(error);

    const client = createClient();

    await expect(client.registerIfAbsent(createBookData())).rejects.toThrow(
      "Notionに接続できません",
    );
  });
});
