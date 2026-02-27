import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type { BookData } from "@techbook-ledger/shared";
import {
  buildNotionProperties,
  normalizeIsbn,
} from "../../src/services/notion-client.js";

// BookData arbitrary generator
const bookDataArb: fc.Arbitrary<BookData> = fc.record({
  isbn: fc.oneof(
    fc.stringOf(fc.constantFrom("0", "1", "2", "3", "4", "5", "6", "7", "8", "9"), {
      minLength: 10,
      maxLength: 10,
    }),
    fc.stringOf(fc.constantFrom("0", "1", "2", "3", "4", "5", "6", "7", "8", "9"), {
      minLength: 13,
      maxLength: 13,
    }),
  ),
  title: fc.string({ minLength: 1, maxLength: 200 }),
  author: fc.string({ minLength: 1, maxLength: 100 }),
  publisher: fc.string({ minLength: 1, maxLength: 100 }),
  price: fc.integer({ min: 100, max: 50000 }),
  publicationDate: fc
    .date({
      min: new Date("1990-01-01"),
      max: new Date("2030-12-31"),
    })
    .map((d) => d.toISOString().split("T")[0]),
  pageCount: fc.integer({ min: 1, max: 5000 }),
  sourceUrl: fc.webUrl(),
});

const registrationDateArb: fc.Arbitrary<Date> = fc.date({
  min: new Date("2020-01-01"),
  max: new Date("2030-12-31"),
});

describe("Feature: tech-book-decision-support, Property 14: BookRecordからNotionプロパティへのマッピング", () => {
  it("should map ISBN to Notion title property for all valid BookData", () => {
    fc.assert(
      fc.property(bookDataArb, registrationDateArb, (bookData, regDate) => {
        const properties = buildNotionProperties(bookData, regDate);
        const isbn = properties["ISBN"] as {
          title: Array<{ text: { content: string } }>;
        };

        expect(isbn).toBeDefined();
        expect(isbn.title).toHaveLength(1);
        expect(isbn.title[0].text.content).toBe(normalizeIsbn(bookData.isbn));
      }),
      { numRuns: 100 },
    );
  });

  it("should map title to Notion rich_text property for all valid BookData", () => {
    fc.assert(
      fc.property(bookDataArb, registrationDateArb, (bookData, regDate) => {
        const properties = buildNotionProperties(bookData, regDate);
        const title = properties["タイトル"] as {
          rich_text: Array<{ text: { content: string } }>;
        };

        expect(title).toBeDefined();
        expect(title.rich_text).toHaveLength(1);
        expect(title.rich_text[0].text.content).toBe(bookData.title);
      }),
      { numRuns: 100 },
    );
  });

  it("should map author to Notion rich_text property for all valid BookData", () => {
    fc.assert(
      fc.property(bookDataArb, registrationDateArb, (bookData, regDate) => {
        const properties = buildNotionProperties(bookData, regDate);
        const author = properties["著者"] as {
          rich_text: Array<{ text: { content: string } }>;
        };

        expect(author).toBeDefined();
        expect(author.rich_text).toHaveLength(1);
        expect(author.rich_text[0].text.content).toBe(bookData.author);
      }),
      { numRuns: 100 },
    );
  });

  it("should map publisher to Notion rich_text property for all valid BookData", () => {
    fc.assert(
      fc.property(bookDataArb, registrationDateArb, (bookData, regDate) => {
        const properties = buildNotionProperties(bookData, regDate);
        const publisher = properties["出版社"] as {
          rich_text: Array<{ text: { content: string } }>;
        };

        expect(publisher).toBeDefined();
        expect(publisher.rich_text).toHaveLength(1);
        expect(publisher.rich_text[0].text.content).toBe(bookData.publisher);
      }),
      { numRuns: 100 },
    );
  });

  it("should map price to Notion number property for all valid BookData", () => {
    fc.assert(
      fc.property(bookDataArb, registrationDateArb, (bookData, regDate) => {
        const properties = buildNotionProperties(bookData, regDate);
        const price = properties["価格"] as { number: number };

        expect(price).toBeDefined();
        expect(price.number).toBe(bookData.price);
      }),
      { numRuns: 100 },
    );
  });

  it("should map publicationDate to Notion date property for all valid BookData", () => {
    fc.assert(
      fc.property(bookDataArb, registrationDateArb, (bookData, regDate) => {
        const properties = buildNotionProperties(bookData, regDate);
        const pubDate = properties["発売日"] as {
          date: { start: string };
        };

        expect(pubDate).toBeDefined();
        expect(pubDate.date.start).toBe(bookData.publicationDate);
      }),
      { numRuns: 100 },
    );
  });

  it("should map pageCount to Notion number property for all valid BookData", () => {
    fc.assert(
      fc.property(bookDataArb, registrationDateArb, (bookData, regDate) => {
        const properties = buildNotionProperties(bookData, regDate);
        const pageCount = properties["ページ数"] as { number: number };

        expect(pageCount).toBeDefined();
        expect(pageCount.number).toBe(bookData.pageCount);
      }),
      { numRuns: 100 },
    );
  });

  it("should map sourceUrl to Notion url property for all valid BookData", () => {
    fc.assert(
      fc.property(bookDataArb, registrationDateArb, (bookData, regDate) => {
        const properties = buildNotionProperties(bookData, regDate);
        const sourceUrl = properties["登録元URL"] as { url: string };

        expect(sourceUrl).toBeDefined();
        expect(sourceUrl.url).toBe(bookData.sourceUrl);
      }),
      { numRuns: 100 },
    );
  });

  it("should auto-assign registrationDate as Notion date property for all valid BookData", () => {
    fc.assert(
      fc.property(bookDataArb, registrationDateArb, (bookData, regDate) => {
        const properties = buildNotionProperties(bookData, regDate);
        const regDateProp = properties["登録日時"] as {
          date: { start: string };
        };

        expect(regDateProp).toBeDefined();
        expect(regDateProp.date.start).toBe(regDate.toISOString());
      }),
      { numRuns: 100 },
    );
  });

  it("should produce exactly 9 properties for all valid BookData", () => {
    fc.assert(
      fc.property(bookDataArb, registrationDateArb, (bookData, regDate) => {
        const properties = buildNotionProperties(bookData, regDate);

        expect(Object.keys(properties)).toHaveLength(9);
        expect(Object.keys(properties).sort()).toEqual(
          [
            "ISBN",
            "タイトル",
            "著者",
            "出版社",
            "価格",
            "発売日",
            "ページ数",
            "登録元URL",
            "登録日時",
          ].sort(),
        );
      }),
      { numRuns: 100 },
    );
  });
});
