import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type { BookData } from "@techbook-ledger/shared";
import {
  identifyMissingFields,
  FIELD_LABELS,
} from "../../src/utils/error-messages.js";

const STRING_FIELD_KEYS: readonly (keyof BookData)[] = [
  "isbn",
  "title",
  "author",
  "publisher",
  "publicationDate",
  "sourceUrl",
];

const NUMBER_FIELD_KEYS: readonly (keyof BookData)[] = ["price", "pageCount"];

const nonEmptyStringArb = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((s) => s.trim().length > 0);
const positiveNumberArb = fc.integer({ min: 1, max: 100000 });

const validBookDataArb: fc.Arbitrary<BookData> = fc.record({
  isbn: fc.stringOf(fc.integer({ min: 0, max: 9 }).map(String), {
    minLength: 10,
    maxLength: 13,
  }),
  title: nonEmptyStringArb,
  author: nonEmptyStringArb,
  publisher: nonEmptyStringArb,
  price: positiveNumberArb,
  publicationDate: fc
    .date({
      min: new Date("1900-01-01"),
      max: new Date("2100-01-01"),
    })
    .map((d) => d.toISOString().split("T")[0]),
  pageCount: positiveNumberArb,
  sourceUrl: fc.webUrl(),
});

describe("Feature: tech-book-decision-support, Property 18: 欠落フィールドの特定", () => {
  it("should return empty array for any valid complete BookData", () => {
    fc.assert(
      fc.property(validBookDataArb, (bookData) => {
        const missing = identifyMissingFields(bookData);
        expect(missing).toEqual([]);
      }),
      { numRuns: 100 },
    );
  });

  it("should detect exactly the fields that have empty string values", () => {
    const emptyMaskArb = fc.record({
      isbn: fc.boolean(),
      title: fc.boolean(),
      author: fc.boolean(),
      publisher: fc.boolean(),
      publicationDate: fc.boolean(),
      sourceUrl: fc.boolean(),
    });

    fc.assert(
      fc.property(
        validBookDataArb,
        emptyMaskArb,
        (baseData, emptyMask) => {
          const data: BookData = {
            ...baseData,
            isbn: emptyMask.isbn ? "" : baseData.isbn,
            title: emptyMask.title ? "" : baseData.title,
            author: emptyMask.author ? "" : baseData.author,
            publisher: emptyMask.publisher ? "" : baseData.publisher,
            publicationDate: emptyMask.publicationDate
              ? ""
              : baseData.publicationDate,
            sourceUrl: emptyMask.sourceUrl ? "" : baseData.sourceUrl,
          };

          const missing = identifyMissingFields(data);

          for (const key of STRING_FIELD_KEYS) {
            const label = FIELD_LABELS[key];
            if (
              (emptyMask as Record<string, boolean>)[key as string] === true
            ) {
              expect(missing).toContain(label);
            } else {
              expect(missing).not.toContain(label);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should detect exactly the number fields that are zero or negative", () => {
    const zeroMaskArb = fc.record({
      price: fc.boolean(),
      pageCount: fc.boolean(),
    });

    fc.assert(
      fc.property(
        validBookDataArb,
        zeroMaskArb,
        (baseData, zeroMask) => {
          const data: BookData = {
            ...baseData,
            price: zeroMask.price ? 0 : baseData.price,
            pageCount: zeroMask.pageCount ? 0 : baseData.pageCount,
          };

          const missing = identifyMissingFields(data);

          for (const key of NUMBER_FIELD_KEYS) {
            const label = FIELD_LABELS[key];
            if ((zeroMask as Record<string, boolean>)[key as string] === true) {
              expect(missing).toContain(label);
            } else {
              expect(missing).not.toContain(label);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should return correct count of missing fields for any combination", () => {
    const boolMaskArb = fc.record({
      isbn: fc.boolean(),
      title: fc.boolean(),
      author: fc.boolean(),
      publisher: fc.boolean(),
      price: fc.boolean(),
      publicationDate: fc.boolean(),
      pageCount: fc.boolean(),
      sourceUrl: fc.boolean(),
    });

    fc.assert(
      fc.property(
        validBookDataArb,
        boolMaskArb,
        (baseData, mask) => {
          const data: BookData = {
            isbn: mask.isbn ? "" : baseData.isbn,
            title: mask.title ? "" : baseData.title,
            author: mask.author ? "" : baseData.author,
            publisher: mask.publisher ? "" : baseData.publisher,
            price: mask.price ? 0 : baseData.price,
            publicationDate: mask.publicationDate
              ? ""
              : baseData.publicationDate,
            pageCount: mask.pageCount ? 0 : baseData.pageCount,
            sourceUrl: mask.sourceUrl ? "" : baseData.sourceUrl,
          };

          const missing = identifyMissingFields(data);
          const expectedCount = Object.values(mask).filter(Boolean).length;
          expect(missing).toHaveLength(expectedCount);
        },
      ),
      { numRuns: 100 },
    );
  });
});
