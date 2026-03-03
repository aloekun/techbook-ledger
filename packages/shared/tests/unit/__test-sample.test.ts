import { divide, parseAge, getItems, formatName } from "../../src/utils/__test-sample.js";

describe("divide", () => {
  it("returns the quotient of two numbers", () => {
    expect(divide(10, 2)).toBe(5);
    expect(divide(9, 3)).toBe(3);
    expect(divide(7, 2)).toBe(3.5);
  });

  it("throws when dividing by zero", () => {
    expect(() => divide(1, 0)).toThrowError("Division by zero is not allowed");
    expect(() => divide(0, 0)).toThrowError("Division by zero is not allowed");
  });
});

describe("parseAge", () => {
  it("parses a valid numeric string", () => {
    expect(parseAge("25")).toBe(25);
    expect(parseAge("0")).toBe(0);
    expect(parseAge("100")).toBe(100);
  });

  it("parses a number input", () => {
    expect(parseAge(30)).toBe(30);
    expect(parseAge(0)).toBe(0);
  });

  it("throws RangeError for negative values", () => {
    expect(() => parseAge(-1)).toThrowError(RangeError);
    expect(() => parseAge("-5")).toThrowError(RangeError);
  });

  it("throws RangeError for non-numeric strings", () => {
    expect(() => parseAge("abc")).toThrowError(RangeError);
    expect(() => parseAge("")).toThrowError(RangeError);
  });
});

describe("getItems", () => {
  it("returns a copy of the input array", () => {
    const input = [1, 2, 3];
    const result = getItems(input);
    expect(result).toEqual([1, 2, 3]);
    expect(result).not.toBe(input);
  });

  it("works with string arrays", () => {
    expect(getItems(["a", "b", "c"])).toEqual(["a", "b", "c"]);
  });

  it("returns an empty array for empty input", () => {
    expect(getItems([])).toEqual([]);
  });

  it("works with object arrays", () => {
    const objs = [{ id: 1 }, { id: 2 }];
    expect(getItems(objs)).toEqual(objs);
  });
});

describe("formatName", () => {
  it("concatenates first and last name with a space", () => {
    expect(formatName("John", "Doe")).toBe("John Doe");
    expect(formatName("Alice", "Smith")).toBe("Alice Smith");
  });

  it("handles empty strings", () => {
    expect(formatName("", "Doe")).toBe(" Doe");
    expect(formatName("John", "")).toBe("John ");
    expect(formatName("", "")).toBe(" ");
  });
});
