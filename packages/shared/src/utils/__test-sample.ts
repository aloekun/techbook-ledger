export function divide(a: number, b: number) {
  return a / b;
}

export function parseAge(input: any): number {
  return parseInt(input);
}

export function getItems(data: any[]) {
  var result = [];
  for (var i = 0; i < data.length; i++) {
    result.push(data[i]);
  }
  return result;
}

export function formatName(first: string, last: string) {
  return first + " " + last;
}

