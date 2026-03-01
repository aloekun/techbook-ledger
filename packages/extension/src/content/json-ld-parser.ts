import type { BookData } from "@techbook-ledger/shared";
import { normalizeIsbn } from "@techbook-ledger/shared";

/**
 * ページ内のすべての<script type="application/ld+json">を取得し、
 * JSONオブジェクトの配列として返す。
 * 無効なJSONは無視し、配列や@graphを含むJSON-LDはフラット化する。
 */
export function extractJsonLd(doc: Document): Record<string, unknown>[] {
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
  const results: Record<string, unknown>[] = [];

  for (const script of scripts) {
    const text = script.textContent?.trim();
    if (!text) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      continue;
    }

    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        pushFlattenedJsonLd(item, results);
      }
    } else {
      pushFlattenedJsonLd(parsed, results);
    }
  }

  return results;
}

/**
 * JSON-LDオブジェクト配列からBook型オブジェクトを検索し、
 * BookData形式に変換して返す。
 * ISBNが欠落しているBookオブジェクトはスキップする。
 * 複数のBookがある場合、最初の有効な（ISBNを持つ）Bookを選択する。
 */
export function findBookData(
  jsonLdObjects: Record<string, unknown>[],
  sourceUrl: string,
): BookData | null {
  for (const obj of jsonLdObjects) {
    if (!isBookType(obj)) continue;

    const isbn = extractIsbn(obj);
    if (!isbn) continue;
    const normalizedIsbn = normalizeIsbn(isbn);
    if (normalizedIsbn.length === 0) continue;

    return {
      isbn: normalizedIsbn,
      title: extractString(obj["name"]) || extractString(obj["headline"]) || "",
      author: extractAuthor(obj["author"]),
      publisher: extractPublisher(obj["publisher"]),
      price: extractPrice(obj["offers"]),
      publicationDate: extractString(obj["datePublished"]) || "",
      pageCount: extractPageCount(obj["numberOfPages"]),
      sourceUrl,
    };
  }

  return null;
}

function pushFlattenedJsonLd(
  node: unknown,
  results: Record<string, unknown>[],
): void {
  if (!isJsonLdObject(node)) return;
  if (Array.isArray(node["@graph"])) {
    for (const item of node["@graph"] as unknown[]) {
      if (isJsonLdObject(item)) results.push(item);
    }
    return;
  }
  results.push(node);
}

function isJsonLdObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBookType(obj: Record<string, unknown>): boolean {
  const type = obj["@type"];
  if (typeof type === "string") {
    return type === "Book";
  }
  if (Array.isArray(type)) {
    return type.includes("Book");
  }
  return false;
}

function extractIsbn(obj: Record<string, unknown>): string | null {
  const isbn = obj["isbn"];
  if (typeof isbn === "string" && isbn.trim().length > 0) {
    return isbn.trim();
  }
  return null;
}

function extractString(value: unknown): string {
  if (typeof value === "string") return value;
  return "";
}

function extractAuthor(value: unknown): string {
  if (typeof value === "string") return value;

  if (Array.isArray(value)) {
    return value
      .map((item) => extractPersonName(item))
      .filter((name) => name.length > 0)
      .join(", ");
  }

  if (isJsonLdObject(value)) {
    return extractPersonName(value);
  }

  return "";
}

function extractPersonName(value: unknown): string {
  if (typeof value === "string") return value;
  if (isJsonLdObject(value) && typeof value["name"] === "string") {
    return value["name"];
  }
  return "";
}

function extractPublisher(value: unknown): string {
  if (typeof value === "string") return value;
  if (isJsonLdObject(value) && typeof value["name"] === "string") {
    return value["name"];
  }
  return "";
}

function extractPrice(value: unknown): number {
  if (value === undefined || value === null) return 0;

  // offers が配列の場合、最初の要素を使う
  const offer = Array.isArray(value) ? value[0] : value;

  if (isJsonLdObject(offer)) {
    const price = offer["price"];
    if (typeof price === "number") return price;
    if (typeof price === "string") {
      const parsed = parseInt(price, 10);
      return isNaN(parsed) ? 0 : parsed;
    }
  }

  return 0;
}

function extractPageCount(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}
