import type {
  BookData,
  RegistrationResponse,
  ExtensionConfig,
} from "@techbook-ledger/shared";
import type { RegisterBookMessage } from "../popup/messages.js";
import { loadConfig as loadConfigFromStorage } from "../storage/config.js";

export interface ServiceWorkerDeps {
  readonly loadConfig?: () => Promise<ExtensionConfig>;
  readonly fetchFn?: typeof fetch;
}

export function parseRegistrationResponse(data: unknown): RegistrationResponse {
  if (typeof data !== "object" || data === null) {
    return {
      success: false,
      message: "サーバーから不正なレスポンスを受信しました",
    };
  }

  const obj = data as Record<string, unknown>;
  const success = typeof obj.success === "boolean" ? obj.success : false;
  const message =
    typeof obj.message === "string" ? obj.message : "不明なエラーが発生しました";

  return {
    success,
    message,
    ...(typeof obj.notionUrl === "string" ? { notionUrl: obj.notionUrl } : {}),
    ...(typeof obj.isDuplicate === "boolean"
      ? { isDuplicate: obj.isDuplicate }
      : {}),
  };
}

export function isRegisterBookMessage(
  message: unknown,
): message is RegisterBookMessage {
  if (typeof message !== "object" || message === null) {
    return false;
  }

  const obj = message as Record<string, unknown>;
  return (
    obj.type === "REGISTER_BOOK" &&
    typeof obj.bookData === "object" &&
    obj.bookData !== null
  );
}

export async function registerBook(
  bookData: BookData,
  deps?: ServiceWorkerDeps,
): Promise<RegistrationResponse> {
  let config: ExtensionConfig;
  try {
    config = await (deps?.loadConfig ?? loadConfigFromStorage)();
  } catch (error) {
    console.error("Failed to load extension config:", error);
    return {
      success: false,
      message:
        "拡張機能の設定を読み込めませんでした。設定ページを確認してください",
    };
  }
  const fetchImpl = deps?.fetchFn ?? fetch;
  const url = `${config.serverEndpoint}/api/books`;

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bookData),
    });
  } catch (error) {
    console.error("Failed to connect to local server:", error);
    return {
      success: false,
      message:
        "ローカルサーバーに接続できません。サーバーを起動してください",
    };
  }

  try {
    const data: unknown = await response.json();
    return parseRegistrationResponse(data);
  } catch (error) {
    console.error("Failed to parse server response:", error);
    return {
      success: false,
      message: `サーバーから予期しないレスポンスを受信しました (HTTP ${String(response.status)})`,
    };
  }
}

export function setupMessageListener(deps?: ServiceWorkerDeps): void {
  chrome.runtime.onMessage.addListener(
    (
      message: unknown,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response: RegistrationResponse) => void,
    ): boolean => {
      if (isRegisterBookMessage(message)) {
        registerBook(message.bookData, deps)
          .then(sendResponse)
          .catch((error: unknown) => {
            console.error("Unexpected error in registerBook:", error);
            sendResponse({
              success: false,
              message: "予期しないエラーが発生しました",
            });
          });
        return true;
      }
      return false;
    },
  );
}

// Auto-initialize when loaded as service worker
setupMessageListener();
