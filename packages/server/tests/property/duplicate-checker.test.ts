import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type { NotionPage } from "../../src/services/notion-client.js";
import { normalizeIsbn } from "../../src/services/notion-client.js";
import type { IsbnQueryable } from "../../src/services/duplicate-checker.js";
import { checkDuplicate } from "../../src/services/duplicate-checker.js";

// ISBN arbitrary generators (reuse pattern from notion-client property tests)
const isbnDigitsArb = fc.oneof(
  fc.stringOf(
    fc.constantFrom("0", "1", "2", "3", "4", "5", "6", "7", "8", "9"),
    { minLength: 10, maxLength: 10 },
  ),
  fc.stringOf(
    fc.constantFrom("0", "1", "2", "3", "4", "5", "6", "7", "8", "9"),
    { minLength: 13, maxLength: 13 },
  ),
);

// ISBN with possible mixed case (for ISBN-10 check digit X)
const isbnWithCaseArb = fc
  .tuple(
    fc.stringOf(
      fc.constantFrom("0", "1", "2", "3", "4", "5", "6", "7", "8", "9"),
      { minLength: 9, maxLength: 9 },
    ),
    fc.constantFrom("X", "x", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"),
  )
  .map(([digits, last]) => digits + last);

// Notion page arbitrary generator
const notionPageArb: fc.Arbitrary<NotionPage> = fc
  .tuple(
    fc.uuid(),
    fc.uuid(),
  )
  .map(([id, urlId]) => ({
    id,
    url: `https://www.notion.so/${urlId}`,
  }));

// Stub client that always finds a duplicate
function createFoundClient(page: NotionPage): IsbnQueryable {
  return {
    queryByIsbn: async () => page,
  };
}

// Stub client that never finds a duplicate
function createNotFoundClient(): IsbnQueryable {
  return {
    queryByIsbn: async () => null,
  };
}

// Spy client that records which ISBN was passed to queryByIsbn
function createSpyClient(result: NotionPage | null): {
  client: IsbnQueryable;
  calledWith: string[];
} {
  const calledWith: string[] = [];
  return {
    client: {
      queryByIsbn: async (isbn: string) => {
        calledWith.push(isbn);
        return result;
      },
    },
    calledWith,
  };
}

describe("Feature: tech-book-decision-support, Property 8: 重複チェックの実行", () => {
  it("should execute ISBN search query for all received ISBNs", async () => {
    await fc.assert(
      fc.asyncProperty(isbnDigitsArb, async (isbn) => {
        const spy = createSpyClient(null);

        await checkDuplicate(isbn, spy.client);

        expect(spy.calledWith).toHaveLength(1);
        expect(spy.calledWith[0]).toBe(isbn);
      }),
      { numRuns: 100 },
    );
  });
});

describe("Feature: tech-book-decision-support, Property 9: 重複時の登録拒否", () => {
  it("should return exists: true and not create new record when ISBN already exists", async () => {
    await fc.assert(
      fc.asyncProperty(isbnDigitsArb, notionPageArb, async (isbn, existingPage) => {
        const client = createFoundClient(existingPage);

        const result = await checkDuplicate(isbn, client);

        expect(result.exists).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("should return exists: false when ISBN does not exist", async () => {
    await fc.assert(
      fc.asyncProperty(isbnDigitsArb, async (isbn) => {
        const client = createNotFoundClient();

        const result = await checkDuplicate(isbn, client);

        expect(result.exists).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});

describe("Feature: tech-book-decision-support, Property 16: ISBN大文字小文字の同一視", () => {
  it("should produce identical normalized ISBN regardless of case", () => {
    fc.assert(
      fc.property(isbnWithCaseArb, (isbn) => {
        const upperIsbn = isbn.toUpperCase();
        const lowerIsbn = isbn.toLowerCase();

        expect(normalizeIsbn(upperIsbn)).toBe(normalizeIsbn(lowerIsbn));
      }),
      { numRuns: 100 },
    );
  });

  it("should detect duplicate regardless of ISBN case", async () => {
    await fc.assert(
      fc.asyncProperty(
        isbnWithCaseArb,
        notionPageArb,
        async (isbn, existingPage) => {
          const upperIsbn = isbn.toUpperCase();
          const lowerIsbn = isbn.toLowerCase();

          // Simulate a client that normalizes internally (like NotionBookClient)
          const normalizedIsbnValue = normalizeIsbn(isbn);
          const normalizingClient: IsbnQueryable = {
            queryByIsbn: async (queriedIsbn: string) => {
              const normalized = normalizeIsbn(queriedIsbn);
              if (normalized === normalizedIsbnValue) {
                return existingPage;
              }
              return null;
            },
          };

          const upperResult = await checkDuplicate(upperIsbn, normalizingClient);
          const lowerResult = await checkDuplicate(lowerIsbn, normalizingClient);

          expect(upperResult.exists).toBe(lowerResult.exists);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe("Feature: tech-book-decision-support, Property 17: 重複検出時のURL返却", () => {
  it("should return existing Notion URL when duplicate is detected", async () => {
    await fc.assert(
      fc.asyncProperty(isbnDigitsArb, notionPageArb, async (isbn, existingPage) => {
        const client = createFoundClient(existingPage);

        const result = await checkDuplicate(isbn, client);

        expect(result.exists).toBe(true);
        expect(result.notionUrl).toBe(existingPage.url);
        expect(result.notionPageId).toBe(existingPage.id);
      }),
      { numRuns: 100 },
    );
  });

  it("should not include URL when no duplicate is found", async () => {
    await fc.assert(
      fc.asyncProperty(isbnDigitsArb, async (isbn) => {
        const client = createNotFoundClient();

        const result = await checkDuplicate(isbn, client);

        expect(result.exists).toBe(false);
        expect(result.notionUrl).toBeUndefined();
        expect(result.notionPageId).toBeUndefined();
      }),
      { numRuns: 100 },
    );
  });
});
