import { describe, it, expect, beforeEach } from "vitest";
import {
  extractJsonLd,
  findBookData,
} from "../../src/content/json-ld-parser.js";

describe("extractJsonLd", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";
  });

  it("should extract a single JSON-LD object from script tag", () => {
    document.head.innerHTML = `
      <script type="application/ld+json">
        {"@type": "Book", "name": "Test Book"}
      </script>
    `;
    const result = extractJsonLd(document);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ "@type": "Book", name: "Test Book" });
  });

  it("should extract multiple JSON-LD objects from multiple script tags", () => {
    document.head.innerHTML = `
      <script type="application/ld+json">
        {"@type": "WebSite", "name": "My Site"}
      </script>
      <script type="application/ld+json">
        {"@type": "Book", "name": "Test Book"}
      </script>
    `;
    const result = extractJsonLd(document);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ "@type": "WebSite", name: "My Site" });
    expect(result[1]).toEqual({ "@type": "Book", name: "Test Book" });
  });

  it("should return empty array when no JSON-LD script tags exist", () => {
    document.head.innerHTML = `
      <script type="text/javascript">console.log("hello")</script>
    `;
    const result = extractJsonLd(document);
    expect(result).toEqual([]);
  });

  it("should skip JSON-LD blocks with invalid JSON", () => {
    document.head.innerHTML = `
      <script type="application/ld+json">
        {invalid json}
      </script>
      <script type="application/ld+json">
        {"@type": "Book", "name": "Valid Book"}
      </script>
    `;
    const result = extractJsonLd(document);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ "@type": "Book", name: "Valid Book" });
  });

  it("should skip JSON-LD blocks with empty content", () => {
    document.head.innerHTML = `
      <script type="application/ld+json"></script>
      <script type="application/ld+json">
        {"@type": "Book", "name": "Valid Book"}
      </script>
    `;
    const result = extractJsonLd(document);
    expect(result).toHaveLength(1);
  });

  it("should handle JSON-LD arrays (multiple objects in one script)", () => {
    document.head.innerHTML = `
      <script type="application/ld+json">
        [{"@type": "WebSite", "name": "My Site"}, {"@type": "Book", "name": "Test Book"}]
      </script>
    `;
    const result = extractJsonLd(document);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ "@type": "WebSite", name: "My Site" });
    expect(result[1]).toEqual({ "@type": "Book", name: "Test Book" });
  });

  it("should handle JSON-LD in body as well as head", () => {
    document.body.innerHTML = `
      <script type="application/ld+json">
        {"@type": "Book", "name": "Body Book"}
      </script>
    `;
    const result = extractJsonLd(document);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ "@type": "Book", name: "Body Book" });
  });

  it("should handle @graph property by flattening contained objects", () => {
    document.head.innerHTML = `
      <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@graph": [
            {"@type": "WebSite", "name": "My Site"},
            {"@type": "Book", "name": "Graph Book"}
          ]
        }
      </script>
    `;
    const result = extractJsonLd(document);
    expect(result).toHaveLength(2);
    expect(result[1]).toEqual({ "@type": "Book", name: "Graph Book" });
  });

  it("should flatten @graph inside array elements", () => {
    document.head.innerHTML = `
      <script type="application/ld+json">
        [
          {
            "@context": "https://schema.org",
            "@graph": [
              {"@type": "Book", "name": "Nested Graph Book", "isbn": "9784297123456"}
            ]
          }
        ]
      </script>
    `;
    const result = extractJsonLd(document);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      "@type": "Book",
      name: "Nested Graph Book",
      isbn: "9784297123456",
    });
  });
});

describe("findBookData", () => {
  it("should find Book type object and extract all fields", () => {
    const jsonLdObjects = [
      {
        "@type": "Book",
        isbn: "978-4-297-12345-6",
        name: "TypeScript入門",
        author: { "@type": "Person", name: "山田太郎" },
        publisher: { "@type": "Organization", name: "技術評論社" },
        offers: { "@type": "Offer", price: "3080", priceCurrency: "JPY" },
        datePublished: "2024-01-15",
        numberOfPages: 320,
      },
    ];
    const result = findBookData(jsonLdObjects, "https://example.com/book");
    expect(result).not.toBeNull();
    expect(result!.isbn).toBe("9784297123456");
    expect(result!.title).toBe("TypeScript入門");
    expect(result!.author).toBe("山田太郎");
    expect(result!.publisher).toBe("技術評論社");
    expect(result!.price).toBe(3080);
    expect(result!.publicationDate).toBe("2024-01-15");
    expect(result!.pageCount).toBe(320);
    expect(result!.sourceUrl).toBe("https://example.com/book");
  });

  it("should return null when no Book type object exists", () => {
    const jsonLdObjects = [
      { "@type": "WebSite", name: "My Site" },
      { "@type": "Product", name: "A Product" },
    ];
    const result = findBookData(jsonLdObjects, "https://example.com");
    expect(result).toBeNull();
  });

  it("should return null for empty array", () => {
    const result = findBookData([], "https://example.com");
    expect(result).toBeNull();
  });

  it("should return null when Book has no ISBN", () => {
    const jsonLdObjects = [
      {
        "@type": "Book",
        name: "No ISBN Book",
        author: { name: "著者" },
        publisher: { name: "出版社" },
        offers: { price: "1000" },
        datePublished: "2024-01-01",
        numberOfPages: 100,
      },
    ];
    const result = findBookData(jsonLdObjects, "https://example.com");
    expect(result).toBeNull();
  });

  it("should select the first valid Book type object from multiple", () => {
    const jsonLdObjects = [
      { "@type": "WebSite", name: "My Site" },
      {
        "@type": "Book",
        isbn: "9784297111111",
        name: "First Book",
        author: { name: "著者1" },
        publisher: { name: "出版社1" },
        offers: { price: "2000" },
        datePublished: "2024-01-01",
        numberOfPages: 200,
      },
      {
        "@type": "Book",
        isbn: "9784297222222",
        name: "Second Book",
        author: { name: "著者2" },
        publisher: { name: "出版社2" },
        offers: { price: "3000" },
        datePublished: "2024-02-01",
        numberOfPages: 300,
      },
    ];
    const result = findBookData(jsonLdObjects, "https://example.com");
    expect(result).not.toBeNull();
    expect(result!.title).toBe("First Book");
    expect(result!.isbn).toBe("9784297111111");
  });

  it("should normalize ISBN by removing hyphens", () => {
    const jsonLdObjects = [
      {
        "@type": "Book",
        isbn: "978-4-297-12345-6",
        name: "Book",
        author: { name: "著者" },
        publisher: { name: "出版社" },
        offers: { price: "1000" },
        datePublished: "2024-01-01",
        numberOfPages: 100,
      },
    ];
    const result = findBookData(jsonLdObjects, "https://example.com");
    expect(result!.isbn).toBe("9784297123456");
  });

  it("should handle author as string", () => {
    const jsonLdObjects = [
      {
        "@type": "Book",
        isbn: "9784297123456",
        name: "Book",
        author: "著者名",
        publisher: { name: "出版社" },
        offers: { price: "1000" },
        datePublished: "2024-01-01",
        numberOfPages: 100,
      },
    ];
    const result = findBookData(jsonLdObjects, "https://example.com");
    expect(result!.author).toBe("著者名");
  });

  it("should handle author as array of Person objects", () => {
    const jsonLdObjects = [
      {
        "@type": "Book",
        isbn: "9784297123456",
        name: "Book",
        author: [
          { "@type": "Person", name: "著者1" },
          { "@type": "Person", name: "著者2" },
        ],
        publisher: { name: "出版社" },
        offers: { price: "1000" },
        datePublished: "2024-01-01",
        numberOfPages: 100,
      },
    ];
    const result = findBookData(jsonLdObjects, "https://example.com");
    expect(result!.author).toBe("著者1, 著者2");
  });

  it("should handle publisher as string", () => {
    const jsonLdObjects = [
      {
        "@type": "Book",
        isbn: "9784297123456",
        name: "Book",
        author: "著者",
        publisher: "出版社名",
        offers: { price: "1000" },
        datePublished: "2024-01-01",
        numberOfPages: 100,
      },
    ];
    const result = findBookData(jsonLdObjects, "https://example.com");
    expect(result!.publisher).toBe("出版社名");
  });

  it("should handle price as number", () => {
    const jsonLdObjects = [
      {
        "@type": "Book",
        isbn: "9784297123456",
        name: "Book",
        author: "著者",
        publisher: "出版社",
        offers: { price: 2980 },
        datePublished: "2024-01-01",
        numberOfPages: 100,
      },
    ];
    const result = findBookData(jsonLdObjects, "https://example.com");
    expect(result!.price).toBe(2980);
  });

  it("should handle offers as array and use first offer price", () => {
    const jsonLdObjects = [
      {
        "@type": "Book",
        isbn: "9784297123456",
        name: "Book",
        author: "著者",
        publisher: "出版社",
        offers: [{ price: "1500" }, { price: "2000" }],
        datePublished: "2024-01-01",
        numberOfPages: 100,
      },
    ];
    const result = findBookData(jsonLdObjects, "https://example.com");
    expect(result!.price).toBe(1500);
  });

  it("should handle numberOfPages as string", () => {
    const jsonLdObjects = [
      {
        "@type": "Book",
        isbn: "9784297123456",
        name: "Book",
        author: "著者",
        publisher: "出版社",
        offers: { price: "1000" },
        datePublished: "2024-01-01",
        numberOfPages: "256",
      },
    ];
    const result = findBookData(jsonLdObjects, "https://example.com");
    expect(result!.pageCount).toBe(256);
  });

  it("should skip first Book without ISBN and find second valid Book", () => {
    const jsonLdObjects = [
      {
        "@type": "Book",
        name: "No ISBN Book",
        author: "著者",
        publisher: "出版社",
        offers: { price: "1000" },
        datePublished: "2024-01-01",
        numberOfPages: 100,
      },
      {
        "@type": "Book",
        isbn: "9784297123456",
        name: "Valid Book",
        author: "著者",
        publisher: "出版社",
        offers: { price: "2000" },
        datePublished: "2024-02-01",
        numberOfPages: 200,
      },
    ];
    const result = findBookData(jsonLdObjects, "https://example.com");
    expect(result).not.toBeNull();
    expect(result!.title).toBe("Valid Book");
  });

  it("should handle Book type in @type array", () => {
    const jsonLdObjects = [
      {
        "@type": ["Product", "Book"],
        isbn: "9784297123456",
        name: "Multi-type Book",
        author: "著者",
        publisher: "出版社",
        offers: { price: "1000" },
        datePublished: "2024-01-01",
        numberOfPages: 100,
      },
    ];
    const result = findBookData(jsonLdObjects, "https://example.com");
    expect(result).not.toBeNull();
    expect(result!.title).toBe("Multi-type Book");
  });

  it("should return null when ISBN becomes empty after normalization", () => {
    const jsonLdObjects = [
      {
        "@type": "Book",
        isbn: "- -",
        name: "Hyphens Only ISBN",
        author: "著者",
        publisher: "出版社",
        offers: { price: "1000" },
        datePublished: "2024-01-01",
        numberOfPages: 100,
      },
    ];
    const result = findBookData(jsonLdObjects, "https://example.com");
    expect(result).toBeNull();
  });

  it("should use default values for missing optional fields", () => {
    const jsonLdObjects = [
      {
        "@type": "Book",
        isbn: "9784297123456",
        name: "Minimal Book",
      },
    ];
    const result = findBookData(jsonLdObjects, "https://example.com");
    expect(result).not.toBeNull();
    expect(result!.author).toBe("");
    expect(result!.publisher).toBe("");
    expect(result!.price).toBe(0);
    expect(result!.publicationDate).toBe("");
    expect(result!.pageCount).toBe(0);
  });
});
