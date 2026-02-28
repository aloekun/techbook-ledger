import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { validateBookRecord } from "../../src/middleware/validator.js";

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

const nonEmptyStringArb = fc.string({ minLength: 1, maxLength: 200 });

const positiveNumberArb = fc.integer({ min: 1, max: 100000 });

const dateStringArb = fc
  .tuple(
    fc.integer({ min: 1900, max: 2100 }),
    fc.integer({ min: 1, max: 12 }),
    fc.integer({ min: 1, max: 28 }),
  )
  .map(
    ([y, m, d]) =>
      `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
  );

const urlArb = fc.webUrl();

const validBookDataArb = fc.record({
  isbn: isbnDigitsArb,
  title: nonEmptyStringArb,
  author: nonEmptyStringArb,
  publisher: nonEmptyStringArb,
  price: positiveNumberArb,
  publicationDate: dateStringArb,
  pageCount: positiveNumberArb,
  sourceUrl: urlArb,
});

const requiredFields = [
  "isbn",
  "title",
  "author",
  "publisher",
  "price",
  "publicationDate",
  "pageCount",
  "sourceUrl",
] as const;

describe("Feature: tech-book-decision-support, Property 12: リクエスト検証の完全性", () => {
  it("should accept all valid BookData inputs", () => {
    fc.assert(
      fc.property(validBookDataArb, (bookData) => {
        const result = validateBookRecord(bookData);

        expect(result.valid).toBe(true);
        expect(result.missingFields).toEqual([]);
      }),
      { numRuns: 100 },
    );
  });

  it("should reject when any single required field is removed", () => {
    fc.assert(
      fc.property(
        validBookDataArb,
        fc.constantFrom(...requiredFields),
        (bookData, fieldToRemove) => {
          const incomplete = { ...bookData };
          delete (incomplete as Record<string, unknown>)[fieldToRemove];

          const result = validateBookRecord(incomplete);

          expect(result.valid).toBe(false);
          expect(result.missingFields).toContain(fieldToRemove);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should reject when any string field is set to empty string", () => {
    const stringFields = [
      "isbn",
      "title",
      "author",
      "publisher",
      "publicationDate",
      "sourceUrl",
    ] as const;

    fc.assert(
      fc.property(
        validBookDataArb,
        fc.constantFrom(...stringFields),
        (bookData, fieldToEmpty) => {
          const modified = {
            ...bookData,
            [fieldToEmpty]: "",
          };

          const result = validateBookRecord(modified);

          expect(result.valid).toBe(false);
          expect(result.missingFields).toContain(fieldToEmpty);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should reject ISBN with invalid digit count", () => {
    const invalidLengthIsbnArb = fc
      .stringOf(
        fc.constantFrom("0", "1", "2", "3", "4", "5", "6", "7", "8", "9"),
        { minLength: 1, maxLength: 30 },
      )
      .filter((s) => s.length !== 10 && s.length !== 13);

    fc.assert(
      fc.property(validBookDataArb, invalidLengthIsbnArb, (bookData, badIsbn) => {
        const modified = { ...bookData, isbn: badIsbn };

        const result = validateBookRecord(modified);

        expect(result.valid).toBe(false);
        expect(result.missingFields).toContain("isbn");
      }),
      { numRuns: 100 },
    );
  });

  it("should reject ISBN containing non-digit characters", () => {
    const nonDigitCharArb = fc
      .char()
      .filter((c) => !/^\d$/.test(c) && c !== "");

    const isbnWithNonDigitArb = fc
      .tuple(
        fc.constantFrom(9, 12),
        nonDigitCharArb,
        fc.integer({ min: 0, max: 12 }),
      )
      .chain(([baseLen, badChar, insertPos]) =>
        fc
          .stringOf(
            fc.constantFrom(
              "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
            ),
            { minLength: baseLen, maxLength: baseLen },
          )
          .map((digits) => {
            const pos = Math.min(insertPos, digits.length);
            return digits.slice(0, pos) + badChar + digits.slice(pos);
          }),
      );

    fc.assert(
      fc.property(validBookDataArb, isbnWithNonDigitArb, (bookData, badIsbn) => {
        const modified = { ...bookData, isbn: badIsbn };

        const result = validateBookRecord(modified);

        expect(result.valid).toBe(false);
        expect(result.missingFields).toContain("isbn");
      }),
      { numRuns: 100 },
    );
  });

  it("should report exactly the fields that are missing", () => {
    fc.assert(
      fc.property(
        validBookDataArb,
        fc.subarray([...requiredFields], { minLength: 1 }),
        (bookData, fieldsToRemove) => {
          const incomplete = { ...bookData };
          for (const field of fieldsToRemove) {
            delete (incomplete as Record<string, unknown>)[field];
          }

          const result = validateBookRecord(incomplete);

          expect(result.valid).toBe(false);
          for (const field of fieldsToRemove) {
            expect(result.missingFields).toContain(field);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
