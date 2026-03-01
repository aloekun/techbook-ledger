import type { BookData } from "@techbook-ledger/shared";

export const FIELD_LABELS: Readonly<Record<keyof BookData, string>> = {
  isbn: "ISBN",
  title: "タイトル",
  author: "著者",
  publisher: "出版社",
  price: "価格",
  publicationDate: "発売日",
  pageCount: "ページ数",
  sourceUrl: "登録元URL",
} as const;

const STRING_FIELDS: readonly (keyof BookData)[] = [
  "isbn",
  "title",
  "author",
  "publisher",
  "publicationDate",
  "sourceUrl",
];

const NUMBER_FIELDS: readonly (keyof BookData)[] = ["price", "pageCount"];

export function identifyMissingFields(data: BookData): readonly string[] {
  const missing: string[] = [];

  for (const field of STRING_FIELDS) {
    const value = data[field];
    if (typeof value !== "string" || value.trim() === "") {
      missing.push(FIELD_LABELS[field]);
    }
  }

  for (const field of NUMBER_FIELDS) {
    const value = data[field];
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
      missing.push(FIELD_LABELS[field]);
    }
  }

  return missing;
}

export function formatMissingFieldsMessage(
  fields: readonly string[],
): string {
  if (fields.length === 0) return "";
  return `次のフィールドが見つかりません: ${fields.join(", ")}`;
}
