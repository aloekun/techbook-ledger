export function divide(a: number, b: number) {
  if (b === 0) {
    throw new Error("Division by zero is not allowed");
  }
  return a / b;
}

export function parseAge(input: string | number): number {
  const str = String(input).trim();
  if (!/^\d+$/.test(str)) {
    throw new RangeError("Invalid age");
  }
  const value = Number.parseInt(str, 10);
  if (Number.isNaN(value) || value < 0) {
    throw new RangeError("Invalid age");
  }
  return value;
}

export function getItems<T>(data: T[]): T[] {
  return [...data];
}

export function formatName(first: string, last: string) {
  return first + " " + last;
}

export function processData<T>(data: readonly (T | null | undefined)[]): T[] {
  const results: T[] = [];
  for (const item of data) {
    if (item != null) {
      results.push(item);
    }
  }
  return results;
}

export function toUpperCase(value: string | undefined) {
  if (value === undefined) {
    throw new TypeError("value must be defined");
  }
  return value.toUpperCase();
}

export function fetchData(url: string): Promise<Response> {
  return fetch(url);
}
