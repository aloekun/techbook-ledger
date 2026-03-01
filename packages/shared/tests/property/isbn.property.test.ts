import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { normalizeIsbn } from "../../src/utils/isbn.js";

// --- Generators ---

/** 数字の文字を生成するジェネレータ */
const digitCharGen = fc.integer({ min: 0, max: 9 }).map(String);

/** 10桁または13桁の数字のみで構成されるISBN */
const isbnDigitsGen = fc.oneof(
  fc
    .array(digitCharGen, { minLength: 10, maxLength: 10 })
    .map((a) => a.join("")),
  fc
    .array(digitCharGen, { minLength: 13, maxLength: 13 })
    .map((a) => a.join("")),
);

/** ハイフン付きISBN生成 */
const isbnWithHyphensGen = isbnDigitsGen.chain((isbn) =>
  fc
    .array(fc.integer({ min: 1, max: isbn.length - 1 }), {
      minLength: 1,
      maxLength: 4,
    })
    .map((positions) => {
      const posSet = new Set(positions);
      const chars = isbn.split("");
      let result = chars[0];
      for (let i = 1; i < chars.length; i++) {
        if (posSet.has(i)) result += "-";
        result += chars[i];
      }
      return { original: isbn, formatted: result };
    }),
);

/** 空白付きISBN生成 */
const isbnWithSpacesGen = isbnDigitsGen.chain((isbn) =>
  fc
    .array(fc.integer({ min: 1, max: isbn.length - 1 }), {
      minLength: 1,
      maxLength: 4,
    })
    .map((positions) => {
      const posSet = new Set(positions);
      const chars = isbn.split("");
      let result = chars[0];
      for (let i = 1; i < chars.length; i++) {
        if (posSet.has(i)) result += " ";
        result += chars[i];
      }
      return { original: isbn, formatted: result };
    }),
);

/** ハイフンと空白混在のISBN生成 */
const isbnMixedGen = isbnDigitsGen.chain((isbn) =>
  fc
    .array(
      fc.tuple(
        fc.integer({ min: 1, max: isbn.length - 1 }),
        fc.constantFrom("-", " "),
      ),
      { minLength: 1, maxLength: 4 },
    )
    .map((insertions) => {
      const posMap = new Map<number, string>();
      for (const [pos, sep] of insertions) {
        posMap.set(pos, sep);
      }
      const chars = isbn.split("");
      let result = chars[0];
      for (let i = 1; i < chars.length; i++) {
        if (posMap.has(i)) result += posMap.get(i);
        result += chars[i];
      }
      return { original: isbn, formatted: result };
    }),
);

// --- Property Tests ---

describe("Feature: tech-book-decision-support, Property 2: ISBN正規化の一貫性", () => {
  it("すべてのISBN文字列（ハイフン付き）に対して、正規化関数は数字のみの文字列を返す", () => {
    fc.assert(
      fc.property(isbnWithHyphensGen, ({ original, formatted }) => {
        const result = normalizeIsbn(formatted);
        expect(result).toBe(original);
        expect(result).toMatch(/^[0-9]+$/);
      }),
      { numRuns: 100 },
    );
  });

  it("すべてのISBN文字列（空白付き）に対して、正規化関数は数字のみの文字列を返す", () => {
    fc.assert(
      fc.property(isbnWithSpacesGen, ({ original, formatted }) => {
        const result = normalizeIsbn(formatted);
        expect(result).toBe(original);
        expect(result).toMatch(/^[0-9]+$/);
      }),
      { numRuns: 100 },
    );
  });

  it("すべてのISBN文字列（ハイフンと空白混在）に対して、正規化関数は数字のみの文字列を返す", () => {
    fc.assert(
      fc.property(isbnMixedGen, ({ original, formatted }) => {
        const result = normalizeIsbn(formatted);
        expect(result).toBe(original);
        expect(result).toMatch(/^[0-9]+$/);
      }),
      { numRuns: 100 },
    );
  });

  it("すべての正規化済みISBNに対して、再度正規化しても結果が変わらない（冪等性）", () => {
    fc.assert(
      fc.property(isbnDigitsGen, (isbn) => {
        const first = normalizeIsbn(isbn);
        const second = normalizeIsbn(first);
        expect(second).toBe(first);
      }),
      { numRuns: 100 },
    );
  });

  it("ISBN-10の末尾Xに対して、大文字小文字に関わらずXに統一される", () => {
    const isbn10WithXGen = fc
      .array(digitCharGen, { minLength: 9, maxLength: 9 })
      .map((a) => a.join(""))
      .chain((digits) =>
        fc.constantFrom("x", "X").map((x) => ({
          digits,
          input: digits + x,
        })),
      );

    fc.assert(
      fc.property(isbn10WithXGen, ({ digits, input }) => {
        const result = normalizeIsbn(input);
        expect(result).toBe(digits + "X");
        expect(result).toMatch(/^[0-9]+X$/);
      }),
      { numRuns: 100 },
    );
  });
});
