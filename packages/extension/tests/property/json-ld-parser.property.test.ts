import { describe, it, expect, beforeEach } from "vitest";
import fc from "fast-check";
import {
  extractJsonLd,
  findBookData,
} from "../../src/content/json-ld-parser.js";

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

/** 空でない安全な文字列 */
const safeStringGen = fc
  .array(
    fc.constantFrom(
      ..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ".split(
        "",
      ),
    ),
    { minLength: 1, maxLength: 50 },
  )
  .map((a) => a.join(""))
  .filter((s) => s.trim().length > 0);

/** 正の整数価格 */
const priceGen = fc.integer({ min: 100, max: 50000 });

/** 日付文字列 YYYY-MM-DD */
const dateGen = fc
  .tuple(
    fc.integer({ min: 2000, max: 2030 }),
    fc.integer({ min: 1, max: 12 }),
    fc.integer({ min: 1, max: 28 }),
  )
  .map(
    ([y, m, d]) =>
      `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
  );

/** ページ数 */
const pageCountGen = fc.integer({ min: 1, max: 2000 });

/** 完全なBook型JSON-LDオブジェクト */
const bookJsonLdGen = fc
  .tuple(
    isbnDigitsGen,
    safeStringGen,
    safeStringGen,
    safeStringGen,
    priceGen,
    dateGen,
    pageCountGen,
  )
  .map(
    ([
      isbn,
      title,
      author,
      publisher,
      price,
      datePublished,
      numberOfPages,
    ]) => ({
      "@type": "Book" as const,
      isbn,
      name: title,
      author: { "@type": "Person", name: author },
      publisher: { "@type": "Organization", name: publisher },
      offers: { "@type": "Offer", price: String(price), priceCurrency: "JPY" },
      datePublished,
      numberOfPages,
    }),
  );

/** 非Book型JSON-LDオブジェクト */
const nonBookJsonLdGen = fc.constantFrom(
  { "@type": "WebSite", name: "Test Site", url: "https://example.com" },
  { "@type": "Organization", name: "Test Org" },
  { "@type": "Product", name: "Test Product" },
  { "@type": "BreadcrumbList", itemListElement: [] },
);

// --- Helper ---

function createDocumentWithJsonLd(jsonLdObjects: unknown[]): Document {
  const doc = document.implementation.createHTMLDocument("test");
  for (const obj of jsonLdObjects) {
    const script = doc.createElement("script");
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(obj);
    doc.head.appendChild(script);
  }
  return doc;
}

// --- Property Tests ---

describe("Feature: tech-book-decision-support, Property 1: JSON-LD解析の完全性", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";
  });

  it("すべての有効なBook型JSON-LDオブジェクトに対して、抽出関数はISBN、タイトル、著者、出版社、価格、発売日、ページ数のすべてのフィールドを正しく抽出する", () => {
    fc.assert(
      fc.property(bookJsonLdGen, (bookJsonLd) => {
        const doc = createDocumentWithJsonLd([bookJsonLd]);
        const extracted = extractJsonLd(doc);
        expect(extracted).toHaveLength(1);

        const result = findBookData(extracted, "https://example.com/test");
        expect(result).not.toBeNull();

        // すべての必須フィールドが正しく抽出されていること
        expect(result!.isbn).toBe(bookJsonLd.isbn);
        expect(result!.title).toBe(bookJsonLd.name);
        expect(result!.author).toBe(
          (bookJsonLd.author as { name: string }).name,
        );
        expect(result!.publisher).toBe(
          (bookJsonLd.publisher as { name: string }).name,
        );
        expect(result!.price).toBe(
          parseInt((bookJsonLd.offers as { price: string }).price, 10),
        );
        expect(result!.publicationDate).toBe(bookJsonLd.datePublished);
        expect(result!.pageCount).toBe(bookJsonLd.numberOfPages);
        expect(result!.sourceUrl).toBe("https://example.com/test");
      }),
      { numRuns: 100 },
    );
  });
});

describe("Feature: tech-book-decision-support, Property 3: ISBN欠落時の登録拒否", () => {
  it("すべてのISBNが欠けているBook型オブジェクトに対して、findBookDataはnullを返す", () => {
    const bookWithoutIsbnGen = safeStringGen.map((name) => ({
      "@type": "Book" as const,
      name,
      author: { "@type": "Person", name: "Author" },
      publisher: { "@type": "Organization", name: "Publisher" },
      offers: { "@type": "Offer", price: "1000" },
      datePublished: "2024-01-01",
      numberOfPages: 100,
    }));

    fc.assert(
      fc.property(bookWithoutIsbnGen, (bookJsonLd) => {
        const result = findBookData(
          [bookJsonLd as unknown as Record<string, unknown>],
          "https://example.com",
        );
        expect(result).toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  it("ISBNが空文字列のBook型オブジェクトに対して、findBookDataはnullを返す", () => {
    const bookWithEmptyIsbnGen = safeStringGen.map((name) => ({
      "@type": "Book" as const,
      isbn: "",
      name,
      author: { "@type": "Person", name: "Author" },
      publisher: { "@type": "Organization", name: "Publisher" },
      offers: { "@type": "Offer", price: "1000" },
      datePublished: "2024-01-01",
      numberOfPages: 100,
    }));

    fc.assert(
      fc.property(bookWithEmptyIsbnGen, (bookJsonLd) => {
        const result = findBookData(
          [bookJsonLd as unknown as Record<string, unknown>],
          "https://example.com",
        );
        expect(result).toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  it("ISBNが空白のみのBook型オブジェクトに対して、findBookDataはnullを返す", () => {
    const whitespaceIsbnGen = fc
      .array(fc.constantFrom(" ", "\t", "\n"), { minLength: 1, maxLength: 5 })
      .map((a) => a.join(""))
      .map((ws) => ({
        "@type": "Book" as const,
        isbn: ws,
        name: "Test Book",
        author: "Author",
        publisher: "Publisher",
        offers: { price: "1000" },
        datePublished: "2024-01-01",
        numberOfPages: 100,
      }));

    fc.assert(
      fc.property(whitespaceIsbnGen, (bookJsonLd) => {
        const result = findBookData(
          [bookJsonLd as unknown as Record<string, unknown>],
          "https://example.com",
        );
        expect(result).toBeNull();
      }),
      { numRuns: 100 },
    );
  });
});

describe("Feature: tech-book-decision-support, Property 4: 複数JSON-LDブロックの処理", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";
  });

  it("すべての複数のJSON-LDブロックを含むページに対して、最初の有効なBook型オブジェクトが選択される", () => {
    fc.assert(
      fc.property(
        fc.array(nonBookJsonLdGen, { minLength: 0, maxLength: 3 }),
        bookJsonLdGen,
        fc.array(fc.oneof(nonBookJsonLdGen, bookJsonLdGen), {
          minLength: 0,
          maxLength: 3,
        }),
        (prefixObjects, firstBook, suffixObjects) => {
          const allObjects = [...prefixObjects, firstBook, ...suffixObjects];

          const doc = createDocumentWithJsonLd(allObjects);
          const extracted = extractJsonLd(doc);
          expect(extracted.length).toBe(allObjects.length);

          const result = findBookData(extracted, "https://example.com");
          expect(result).not.toBeNull();

          // 最初の有効なBookが選択されること
          expect(result!.isbn).toBe(firstBook.isbn);
          expect(result!.title).toBe(firstBook.name);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Book型オブジェクトが存在しない複数ブロックに対して、nullが返される", () => {
    fc.assert(
      fc.property(
        fc.array(nonBookJsonLdGen, { minLength: 1, maxLength: 5 }),
        (nonBookObjects) => {
          const doc = createDocumentWithJsonLd(nonBookObjects);
          const extracted = extractJsonLd(doc);
          const result = findBookData(extracted, "https://example.com");
          expect(result).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });
});
