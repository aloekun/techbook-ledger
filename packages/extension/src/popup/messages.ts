import type { BookData, RegistrationResponse } from "@techbook-ledger/shared";

export interface GetBookDataMessage {
  readonly type: "GET_BOOK_DATA";
}

export interface GetBookDataResponse {
  readonly bookData: BookData | null;
}

export interface RegisterBookMessage {
  readonly type: "REGISTER_BOOK";
  readonly bookData: BookData;
}

export type PopupToContentMessage = GetBookDataMessage;
export type PopupToBackgroundMessage = RegisterBookMessage;

export type { BookData, RegistrationResponse };
