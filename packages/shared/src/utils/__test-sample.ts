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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function processData(data: any) {
  var results = [];
  for (var i = 0; i < data.length; i++) {
    if (data[i] != null) {
      results.push(data[i]);
    }
  }
  return results;
}

export function toUpperCase(value: string | undefined) {
  return value!.toUpperCase();
}

export function fetchData(url: string): any {
  // eslint-disable-next-line no-eval
  return eval("fetch('" + url + "')");
}
