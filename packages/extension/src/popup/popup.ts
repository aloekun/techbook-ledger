import type { BookData, RegistrationResponse } from "@techbook-ledger/shared";
import type { PopupState } from "./popup-state.js";
import {
  createInitialState,
  derivePopupState,
  createLoadingState,
  createResultState,
  createResetState,
  formatBookInfoHtml,
} from "./popup-state.js";

export { formatBookInfoHtml } from "./popup-state.js";

interface PopupElements {
  readonly statusDiv: HTMLDivElement;
  readonly bookInfoDiv: HTMLDivElement;
  readonly registerBtn: HTMLButtonElement;
  readonly messageDiv: HTMLDivElement;
}

interface PopupDeps {
  readonly getBookData?: () => Promise<BookData | null>;
  readonly registerBook?: (bookData: BookData) => Promise<RegistrationResponse>;
  readonly scheduleReset?: (callback: () => void, ms: number) => void;
}

const STATUS_CLASSES = [
  "inactive",
  "ready",
  "loading",
  "success",
  "error",
] as const;

const STATUS_TEXT: Record<PopupState["status"], string> = {
  inactive: "このページは対応していません",
  ready: "登録可能",
  loading: "登録中...",
  success: "完了",
  error: "エラー",
};

function renderState(state: PopupState, elements: PopupElements): void {
  const { statusDiv, bookInfoDiv, registerBtn, messageDiv } = elements;

  // Update status
  for (const cls of STATUS_CLASSES) {
    statusDiv.classList.remove(cls);
  }
  statusDiv.classList.add(state.status);
  statusDiv.textContent = state.message || STATUS_TEXT[state.status];

  // Update book info
  if (state.bookData) {
    bookInfoDiv.innerHTML = formatBookInfoHtml(state.bookData);
  } else {
    bookInfoDiv.innerHTML = "";
  }

  // Update register button
  registerBtn.disabled = state.status !== "ready";

  // Update message
  if (state.status === "success" || state.status === "error") {
    messageDiv.textContent = state.message;
    messageDiv.className = state.status === "success" ? "success" : "error";
  } else {
    messageDiv.textContent = "";
    messageDiv.className = "";
  }
}

function getPopupElements(): PopupElements | null {
  const statusDiv = document.getElementById("status");
  const bookInfoDiv = document.getElementById("book-info");
  const registerBtn = document.getElementById("register-btn");
  const messageDiv = document.getElementById("message");

  if (
    !(statusDiv instanceof HTMLDivElement) ||
    !(bookInfoDiv instanceof HTMLDivElement) ||
    !(registerBtn instanceof HTMLButtonElement) ||
    !(messageDiv instanceof HTMLDivElement)
  ) {
    return null;
  }

  return { statusDiv, bookInfoDiv, registerBtn, messageDiv };
}

async function defaultGetBookData(): Promise<BookData | null> {
  const tabs = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  const tab = tabs[0];
  if (!tab?.id) return null;

  const response = await chrome.tabs.sendMessage(tab.id, {
    type: "GET_BOOK_DATA",
  });
  return (response as { bookData: BookData | null })?.bookData ?? null;
}

async function defaultRegisterBook(
  bookData: BookData,
): Promise<RegistrationResponse> {
  return chrome.runtime.sendMessage({
    type: "REGISTER_BOOK",
    bookData,
  }) as Promise<RegistrationResponse>;
}

function defaultScheduleReset(callback: () => void, ms: number): void {
  setTimeout(callback, ms);
}

export async function initPopup(deps?: PopupDeps): Promise<void> {
  const elements = getPopupElements();
  if (!elements) return;

  const getBookData = deps?.getBookData ?? defaultGetBookData;
  const registerBook = deps?.registerBook ?? defaultRegisterBook;
  const scheduleReset = deps?.scheduleReset ?? defaultScheduleReset;

  // Render initial state
  renderState(createInitialState(), elements);

  // Fetch book data from content script
  let bookData: BookData | null;
  try {
    bookData = await getBookData();
  } catch {
    renderState(
      {
        status: "error",
        bookData: null,
        message: "書籍データの取得に失敗しました",
      },
      elements,
    );
    return;
  }

  // Derive and render state from book data
  const state = derivePopupState(bookData);
  renderState(state, elements);

  if (!bookData) return;

  // Attach click handler for registration
  elements.registerBtn.addEventListener("click", () => {
    void handleRegister(bookData, elements, registerBook, scheduleReset);
  });
}

async function handleRegister(
  bookData: BookData,
  elements: PopupElements,
  registerBook: (bookData: BookData) => Promise<RegistrationResponse>,
  scheduleReset: (callback: () => void, ms: number) => void,
): Promise<void> {
  // Transition to loading
  renderState(createLoadingState(bookData), elements);

  let response: RegistrationResponse;
  try {
    response = await registerBook(bookData);
  } catch {
    renderState(
      {
        status: "error",
        bookData,
        message: "サーバーとの通信に失敗しました",
      },
      elements,
    );
    return;
  }

  // Render result
  const resultState = createResultState(bookData, response);
  renderState(resultState, elements);

  // Schedule reset to ready state after 3 seconds
  scheduleReset(() => {
    renderState(createResetState(bookData), elements);
  }, 3000);
}

// Auto-initialize when loaded in browser
function autoInit(): void {
  const status = document.getElementById("status");
  if (status) {
    void initPopup().catch(() => {
      const messageDiv = document.getElementById("message");
      if (messageDiv instanceof HTMLDivElement) {
        messageDiv.textContent = "Popup の初期化に失敗しました。";
        messageDiv.className = "error";
      }
    });
  }
}

if (typeof document !== "undefined" && document.readyState !== "loading") {
  autoInit();
} else if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", autoInit);
}
