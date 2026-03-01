import { describe, it, expect } from "vitest";
import { normalizeIsbn } from "../../src/utils/isbn.js";

describe("normalizeIsbn", () => {
  it("should remove hyphens from ISBN-13", () => {
    expect(normalizeIsbn("978-4-297-12345-6")).toBe("9784297123456");
  });

  it("should remove hyphens from ISBN-10", () => {
    expect(normalizeIsbn("4-297-12345-X")).toBe("429712345X");
  });

  it("should remove spaces from ISBN-13", () => {
    expect(normalizeIsbn("978 4 297 12345 6")).toBe("9784297123456");
  });

  it("should remove spaces from ISBN-10", () => {
    expect(normalizeIsbn("4 297 12345 X")).toBe("429712345X");
  });

  it("should handle mixed hyphens and spaces", () => {
    expect(normalizeIsbn("978-4 297-12345 6")).toBe("9784297123456");
  });

  it("should return digits-only string unchanged", () => {
    expect(normalizeIsbn("9784297123456")).toBe("9784297123456");
  });

  it("should preserve uppercase X in ISBN-10", () => {
    expect(normalizeIsbn("123456789X")).toBe("123456789X");
  });

  it("should convert lowercase x to uppercase X in ISBN-10", () => {
    expect(normalizeIsbn("123456789x")).toBe("123456789X");
  });

  it("should handle empty string", () => {
    expect(normalizeIsbn("")).toBe("");
  });
});
