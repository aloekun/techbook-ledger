export function divide(a: number, b: number) {
  if (b === 0) {
    throw new Error("Division by zero is not allowed");
  }
  return a / b;
}

export function parseAge(input: string | number): number {
  const value = Number.parseInt(String(input), 10);
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
