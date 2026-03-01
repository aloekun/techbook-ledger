import type { BookData, RegistrationResponse } from "@techbook-ledger/shared";
import {
  identifyMissingFields,
  formatMissingFieldsMessage,
} from "../utils/error-messages.js";

export type PopupStatus =
  | "inactive"
  | "ready"
  | "loading"
  | "success"
  | "error";

export interface PopupState {
  readonly status: PopupStatus;
  readonly bookData: BookData | null;
  readonly message: string;
  readonly retryable?: boolean;
}

export function createInitialState(): PopupState {
  return { status: "inactive", bookData: null, message: "" };
}

export function derivePopupState(bookData: BookData | null): PopupState {
  if (bookData === null) {
    return {
      status: "inactive",
      bookData: null,
      message: "このページは対応していません",
    };
  }

  const missingFields = identifyMissingFields(bookData);
  if (missingFields.length > 0) {
    return {
      status: "error",
      bookData,
      message: formatMissingFieldsMessage(missingFields),
    };
  }

  return { status: "ready", bookData, message: "" };
}

export function createLoadingState(bookData: BookData): PopupState {
  return { status: "loading", bookData, message: "" };
}

export function createResultState(
  bookData: BookData,
  response: RegistrationResponse,
): PopupState {
  if (response.success || response.isDuplicate) {
    return { status: "success", bookData, message: response.message };
  }
  return { status: "error", bookData, message: response.message };
}

export function createResetState(bookData: BookData): PopupState {
  return { status: "ready", bookData, message: "" };
}

export function formatPrice(price: number): string {
  return `${price.toLocaleString("ja-JP")}円`;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatBookInfoHtml(bookData: BookData): string {
  const fields = [
    { label: "タイトル", value: bookData.title },
    { label: "著者", value: bookData.author },
    { label: "出版社", value: bookData.publisher },
    { label: "ISBN", value: bookData.isbn },
    { label: "価格", value: formatPrice(bookData.price) },
    { label: "発売日", value: bookData.publicationDate },
    { label: "ページ数", value: bookData.pageCount > 0 ? `${bookData.pageCount}p` : "" },
  ];

  return fields
    .map(
      ({ label, value }) =>
        `<div class="book-field"><span class="book-field-label">${escapeHtml(label)}: </span><span class="book-field-value">${escapeHtml(String(value))}</span></div>`,
    )
    .join("");
}
