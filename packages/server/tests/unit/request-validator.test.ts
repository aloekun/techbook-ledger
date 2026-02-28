import { describe, it, expect } from "vitest";
import { validateBookRecord } from "../../src/middleware/validator.js";

function createValidBookData(): Record<string, unknown> {
  return {
    isbn: "9784297138189",
    title: "Software Design 2024年1月号",
    author: "技術評論社編集部",
    publisher: "技術評論社",
    price: 1342,
    publicationDate: "2023-12-18",
    pageCount: 184,
    sourceUrl: "https://gihyo.jp/magazine/SD/archive/2024/202401",
  };
}

describe("validateBookRecord", () => {
  describe("valid input", () => {
    it("should return valid: true for a complete BookData", () => {
      const result = validateBookRecord(createValidBookData());

      expect(result.valid).toBe(true);
      expect(result.missingFields).toEqual([]);
    });

    it("should return valid: true when extra fields are present", () => {
      const data = { ...createValidBookData(), extraField: "extra", anotherOne: 42 };

      const result = validateBookRecord(data);

      expect(result.valid).toBe(true);
      expect(result.missingFields).toEqual([]);
    });

    it("should accept ISBN with 10 digits", () => {
      const data = { ...createValidBookData(), isbn: "4297138182" };

      const result = validateBookRecord(data);

      expect(result.valid).toBe(true);
    });

    it("should accept ISBN with 13 digits", () => {
      const data = { ...createValidBookData(), isbn: "9784297138189" };

      const result = validateBookRecord(data);

      expect(result.valid).toBe(true);
    });
  });

  describe("missing fields", () => {
    it("should report missing isbn", () => {
      const data = createValidBookData();
      delete data.isbn;

      const result = validateBookRecord(data);

      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain("isbn");
    });

    it("should report missing title", () => {
      const data = createValidBookData();
      delete data.title;

      const result = validateBookRecord(data);

      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain("title");
    });

    it("should report missing author", () => {
      const data = createValidBookData();
      delete data.author;

      const result = validateBookRecord(data);

      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain("author");
    });

    it("should report missing publisher", () => {
      const data = createValidBookData();
      delete data.publisher;

      const result = validateBookRecord(data);

      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain("publisher");
    });

    it("should report missing price", () => {
      const data = createValidBookData();
      delete data.price;

      const result = validateBookRecord(data);

      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain("price");
    });

    it("should report missing publicationDate", () => {
      const data = createValidBookData();
      delete data.publicationDate;

      const result = validateBookRecord(data);

      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain("publicationDate");
    });

    it("should report missing pageCount", () => {
      const data = createValidBookData();
      delete data.pageCount;

      const result = validateBookRecord(data);

      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain("pageCount");
    });

    it("should report missing sourceUrl", () => {
      const data = createValidBookData();
      delete data.sourceUrl;

      const result = validateBookRecord(data);

      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain("sourceUrl");
    });

    it("should report all missing fields when multiple are absent", () => {
      const data = createValidBookData();
      delete data.isbn;
      delete data.title;
      delete data.price;

      const result = validateBookRecord(data);

      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain("isbn");
      expect(result.missingFields).toContain("title");
      expect(result.missingFields).toContain("price");
      expect(result.missingFields).toHaveLength(3);
    });
  });

  describe("type validation", () => {
    it("should reject price as string", () => {
      const data = { ...createValidBookData(), price: "1342" };

      const result = validateBookRecord(data);

      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain("price");
    });

    it("should reject pageCount as string", () => {
      const data = { ...createValidBookData(), pageCount: "184" };

      const result = validateBookRecord(data);

      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain("pageCount");
    });

    it("should reject isbn as number", () => {
      const data = { ...createValidBookData(), isbn: 9784297138189 };

      const result = validateBookRecord(data);

      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain("isbn");
    });

    it("should reject NaN for price", () => {
      const data = { ...createValidBookData(), price: NaN };

      const result = validateBookRecord(data);

      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain("price");
    });

    it("should reject Infinity for pageCount", () => {
      const data = { ...createValidBookData(), pageCount: Infinity };

      const result = validateBookRecord(data);

      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain("pageCount");
    });

    it("should reject negative price", () => {
      const data = { ...createValidBookData(), price: -100 };

      const result = validateBookRecord(data);

      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain("price");
    });

    it("should reject zero for pageCount", () => {
      const data = { ...createValidBookData(), pageCount: 0 };

      const result = validateBookRecord(data);

      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain("pageCount");
    });
  });

  describe("empty string validation", () => {
    it("should reject empty isbn", () => {
      const data = { ...createValidBookData(), isbn: "" };

      const result = validateBookRecord(data);

      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain("isbn");
    });

    it("should reject empty title", () => {
      const data = { ...createValidBookData(), title: "" };

      const result = validateBookRecord(data);

      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain("title");
    });

    it("should reject empty author", () => {
      const data = { ...createValidBookData(), author: "" };

      const result = validateBookRecord(data);

      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain("author");
    });

    it("should reject empty publisher", () => {
      const data = { ...createValidBookData(), publisher: "" };

      const result = validateBookRecord(data);

      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain("publisher");
    });

    it("should reject empty publicationDate", () => {
      const data = { ...createValidBookData(), publicationDate: "" };

      const result = validateBookRecord(data);

      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain("publicationDate");
    });

    it("should reject empty sourceUrl", () => {
      const data = { ...createValidBookData(), sourceUrl: "" };

      const result = validateBookRecord(data);

      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain("sourceUrl");
    });
  });

  describe("ISBN format validation", () => {
    it("should reject ISBN with 9 digits", () => {
      const data = { ...createValidBookData(), isbn: "429713818" };

      const result = validateBookRecord(data);

      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain("isbn");
    });

    it("should reject ISBN with 11 digits", () => {
      const data = { ...createValidBookData(), isbn: "42971381891" };

      const result = validateBookRecord(data);

      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain("isbn");
    });

    it("should reject ISBN with 12 digits", () => {
      const data = { ...createValidBookData(), isbn: "429713818912" };

      const result = validateBookRecord(data);

      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain("isbn");
    });

    it("should reject ISBN with 14 digits", () => {
      const data = { ...createValidBookData(), isbn: "97842971381890" };

      const result = validateBookRecord(data);

      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain("isbn");
    });

    it("should reject ISBN containing hyphens", () => {
      const data = { ...createValidBookData(), isbn: "978-4-297-13818-9" };

      const result = validateBookRecord(data);

      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain("isbn");
    });

    it("should reject ISBN containing letters", () => {
      const data = { ...createValidBookData(), isbn: "978429713X" };

      const result = validateBookRecord(data);

      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain("isbn");
    });

    it("should reject ISBN containing spaces", () => {
      const data = { ...createValidBookData(), isbn: "978 4297138189" };

      const result = validateBookRecord(data);

      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain("isbn");
    });
  });

  describe("null/undefined input", () => {
    it("should report all fields missing for null input", () => {
      const result = validateBookRecord(null);

      expect(result.valid).toBe(false);
      expect(result.missingFields).toHaveLength(8);
      expect(result.missingFields).toContain("isbn");
      expect(result.missingFields).toContain("title");
      expect(result.missingFields).toContain("author");
      expect(result.missingFields).toContain("publisher");
      expect(result.missingFields).toContain("price");
      expect(result.missingFields).toContain("publicationDate");
      expect(result.missingFields).toContain("pageCount");
      expect(result.missingFields).toContain("sourceUrl");
    });

    it("should report all fields missing for undefined input", () => {
      const result = validateBookRecord(undefined);

      expect(result.valid).toBe(false);
      expect(result.missingFields).toHaveLength(8);
    });

    it("should report all fields missing for non-object input", () => {
      const result = validateBookRecord("not an object");

      expect(result.valid).toBe(false);
      expect(result.missingFields).toHaveLength(8);
    });

    it("should report all fields missing for empty object", () => {
      const result = validateBookRecord({});

      expect(result.valid).toBe(false);
      expect(result.missingFields).toHaveLength(8);
    });
  });
});
