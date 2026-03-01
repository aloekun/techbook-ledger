import type { BookData } from "@techbook-ledger/shared";
import { extractJsonLd, findBookData } from "./json-ld-parser.js";
import type { GetBookDataResponse } from "../popup/messages.js";

function isGetBookDataMessage(message: unknown): boolean {
  if (typeof message !== "object" || message === null) return false;
  return (message as Record<string, unknown>).type === "GET_BOOK_DATA";
}

export function handleGetBookData(): GetBookDataResponse {
  const jsonLdObjects = extractJsonLd(document);
  const bookData: BookData | null = findBookData(
    jsonLdObjects,
    window.location.href,
  );
  return { bookData };
}

export function setupContentScript(): void {
  chrome.runtime.onMessage.addListener(
    (
      message: unknown,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response: GetBookDataResponse) => void,
    ): boolean | undefined => {
      if (isGetBookDataMessage(message)) {
        sendResponse(handleGetBookData());
        return;
      }
      return undefined;
    },
  );
}

// Auto-initialize when loaded as content script
setupContentScript();
