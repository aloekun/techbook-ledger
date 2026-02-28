import { describe, it, expect, vi } from "vitest";
import type { NotionPage } from "../../src/services/notion-client.js";
import type { IsbnQueryable } from "../../src/services/duplicate-checker.js";
import { checkDuplicate } from "../../src/services/duplicate-checker.js";

function createStubClient(
  result: NotionPage | null,
): IsbnQueryable & { queryByIsbn: ReturnType<typeof vi.fn> } {
  return {
    queryByIsbn: vi.fn().mockResolvedValue(result),
  };
}

describe("checkDuplicate", () => {
  it("should return exists: false when no matching record found", async () => {
    const client = createStubClient(null);

    const result = await checkDuplicate("9784297138189", client);

    expect(result.exists).toBe(false);
    expect(result.notionPageId).toBeUndefined();
    expect(result.notionUrl).toBeUndefined();
  });

  it("should return exists: true with pageId and url when matching record found", async () => {
    const client = createStubClient({
      id: "page-id-123",
      url: "https://www.notion.so/page-id-123",
    });

    const result = await checkDuplicate("9784297138189", client);

    expect(result.exists).toBe(true);
    expect(result.notionPageId).toBe("page-id-123");
    expect(result.notionUrl).toBe("https://www.notion.so/page-id-123");
  });

  it("should always call queryByIsbn to execute the search", async () => {
    const client = createStubClient(null);

    await checkDuplicate("9784297138189", client);

    expect(client.queryByIsbn).toHaveBeenCalledTimes(1);
    expect(client.queryByIsbn).toHaveBeenCalledWith("9784297138189");
  });

  it("should pass the isbn directly to queryByIsbn for normalization", async () => {
    const client = createStubClient(null);

    await checkDuplicate("978X123456X", client);

    expect(client.queryByIsbn).toHaveBeenCalledWith("978X123456X");
  });

  it("should treat uppercase and lowercase ISBN as the same via queryByIsbn normalization", async () => {
    const upperClient = createStubClient({
      id: "page-upper",
      url: "https://www.notion.so/page-upper",
    });
    const lowerClient = createStubClient({
      id: "page-lower",
      url: "https://www.notion.so/page-lower",
    });

    await checkDuplicate("978X123456X", upperClient);
    await checkDuplicate("978x123456x", lowerClient);

    // Both should call queryByIsbn - normalization happens inside queryByIsbn
    expect(upperClient.queryByIsbn).toHaveBeenCalledTimes(1);
    expect(lowerClient.queryByIsbn).toHaveBeenCalledTimes(1);
  });

  it("should propagate errors from queryByIsbn", async () => {
    const client = {
      queryByIsbn: vi.fn().mockRejectedValue(new Error("Connection failed")),
    };

    await expect(checkDuplicate("9784297138189", client)).rejects.toThrow(
      "Connection failed",
    );
  });
});
