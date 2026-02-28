import type { ValidationResult } from "@techbook-ledger/shared";

const STRING_FIELDS = [
  "isbn",
  "title",
  "author",
  "publisher",
  "publicationDate",
  "sourceUrl",
] as const;

const NUMBER_FIELDS = ["price", "pageCount"] as const;

const ALL_REQUIRED_FIELDS: readonly string[] = [
  ...STRING_FIELDS,
  ...NUMBER_FIELDS,
];

const ISBN_PATTERN = /^\d{10}$|^\d{13}$/;

function isNonNullObject(data: unknown): data is Record<string, unknown> {
  return typeof data === "object" && data !== null && !Array.isArray(data);
}

export function validateBookRecord(data: unknown): ValidationResult {
  if (!isNonNullObject(data)) {
    return { valid: false, missingFields: ALL_REQUIRED_FIELDS };
  }

  const missingFields: string[] = [];

  for (const field of STRING_FIELDS) {
    const value = data[field];
    if (typeof value !== "string" || value === "") {
      missingFields.push(field);
    }
  }

  for (const field of NUMBER_FIELDS) {
    const value = data[field];
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
      missingFields.push(field);
    }
  }

  if (
    !missingFields.includes("isbn") &&
    !ISBN_PATTERN.test(data.isbn as string)
  ) {
    missingFields.push("isbn");
  }

  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}
