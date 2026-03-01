import { describe, it, expect } from "vitest";
import type { BookData } from "@techbook-ledger/shared";
import {
  identifyMissingFields,
  formatMissingFieldsMessage,
} from "../../src/utils/error-messages.js";

const completeBookData: BookData = {
  isbn: "9784297138189",
  title: "TypeScript入門",
  author: "鈴木僚太",
  publisher: "技術評論社",
  price: 3278,
  publicationDate: "2022-04-22",
  pageCount: 424,
  sourceUrl: "https://gihyo.jp/book/2022/978-4-297-13818-9",
};

describe("identifyMissingFields", () => {
  it("should return empty array for complete BookData", () => {
    const result = identifyMissingFields(completeBookData);
    expect(result).toEqual([]);
  });

  it("should detect empty title", () => {
    const data: BookData = { ...completeBookData, title: "" };
    const result = identifyMissingFields(data);
    expect(result).toContain("タイトル");
  });

  it("should detect empty author", () => {
    const data: BookData = { ...completeBookData, author: "" };
    const result = identifyMissingFields(data);
    expect(result).toContain("著者");
  });

  it("should detect empty publisher", () => {
    const data: BookData = { ...completeBookData, publisher: "" };
    const result = identifyMissingFields(data);
    expect(result).toContain("出版社");
  });

  it("should detect empty isbn", () => {
    const data: BookData = { ...completeBookData, isbn: "" };
    const result = identifyMissingFields(data);
    expect(result).toContain("ISBN");
  });

  it("should detect empty publicationDate", () => {
    const data: BookData = { ...completeBookData, publicationDate: "" };
    const result = identifyMissingFields(data);
    expect(result).toContain("発売日");
  });

  it("should detect empty sourceUrl", () => {
    const data: BookData = { ...completeBookData, sourceUrl: "" };
    const result = identifyMissingFields(data);
    expect(result).toContain("登録元URL");
  });

  it("should detect price of 0", () => {
    const data: BookData = { ...completeBookData, price: 0 };
    const result = identifyMissingFields(data);
    expect(result).toContain("価格");
  });

  it("should detect negative price", () => {
    const data: BookData = { ...completeBookData, price: -100 };
    const result = identifyMissingFields(data);
    expect(result).toContain("価格");
  });

  it("should detect pageCount of 0", () => {
    const data: BookData = { ...completeBookData, pageCount: 0 };
    const result = identifyMissingFields(data);
    expect(result).toContain("ページ数");
  });

  it("should detect negative pageCount", () => {
    const data: BookData = { ...completeBookData, pageCount: -1 };
    const result = identifyMissingFields(data);
    expect(result).toContain("ページ数");
  });

  it("should detect multiple missing fields", () => {
    const data: BookData = {
      ...completeBookData,
      title: "",
      author: "",
      price: 0,
    };
    const result = identifyMissingFields(data);
    expect(result).toContain("タイトル");
    expect(result).toContain("著者");
    expect(result).toContain("価格");
    expect(result).toHaveLength(3);
  });

  it("should detect all missing fields when all are empty/zero", () => {
    const data: BookData = {
      isbn: "",
      title: "",
      author: "",
      publisher: "",
      price: 0,
      publicationDate: "",
      pageCount: 0,
      sourceUrl: "",
    };
    const result = identifyMissingFields(data);
    expect(result).toHaveLength(8);
  });

  it("should not mutate the input data", () => {
    const data: BookData = { ...completeBookData, title: "" };
    const original = { ...data };
    identifyMissingFields(data);
    expect(data).toEqual(original);
  });

  it("should return field names in deterministic order", () => {
    const data: BookData = {
      isbn: "",
      title: "",
      author: "",
      publisher: "",
      price: 0,
      publicationDate: "",
      pageCount: 0,
      sourceUrl: "",
    };
    const result = identifyMissingFields(data);
    expect(result).toEqual([
      "ISBN",
      "タイトル",
      "著者",
      "出版社",
      "発売日",
      "登録元URL",
      "価格",
      "ページ数",
    ]);
  });

  it("should treat whitespace-only strings as missing", () => {
    const data: BookData = { ...completeBookData, title: "   " };
    const result = identifyMissingFields(data);
    expect(result).toContain("タイトル");
  });
});

describe("formatMissingFieldsMessage", () => {
  it("should return empty string for empty array", () => {
    expect(formatMissingFieldsMessage([])).toBe("");
  });

  it("should format single field", () => {
    expect(formatMissingFieldsMessage(["タイトル"])).toBe(
      "次のフィールドが見つかりません: タイトル",
    );
  });

  it("should format multiple fields with comma separator", () => {
    expect(formatMissingFieldsMessage(["タイトル", "著者"])).toBe(
      "次のフィールドが見つかりません: タイトル, 著者",
    );
  });

  it("should format many fields", () => {
    const fields = ["ISBN", "タイトル", "著者", "出版社"];
    const result = formatMissingFieldsMessage(fields);
    expect(result).toBe(
      "次のフィールドが見つかりません: ISBN, タイトル, 著者, 出版社",
    );
  });

  it("should not mutate the input array", () => {
    const fields = ["タイトル", "著者"];
    const original = [...fields];
    formatMissingFieldsMessage(fields);
    expect(fields).toEqual(original);
  });
});
