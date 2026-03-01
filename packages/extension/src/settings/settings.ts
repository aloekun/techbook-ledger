import { loadConfig, saveConfig } from "../storage/config.js";

/**
 * Validate that the given URL is a valid localhost HTTP endpoint.
 * Only http://localhost[:port] and http://127.0.0.1[:port] are accepted.
 * No paths, query strings, or fragments are allowed.
 */
export function validateEndpoint(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== "http:") {
    return false;
  }

  if (parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
    return false;
  }

  // Reject paths, query strings, fragments
  if (parsed.pathname !== "/" || parsed.search !== "" || parsed.hash !== "") {
    return false;
  }

  // Validate port range if specified
  if (parsed.port !== "") {
    const port = Number(parsed.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return false;
    }
  }

  // Reconstruct expected URL to ensure no extra content
  const expectedWithPort = parsed.port
    ? `http://${parsed.hostname}:${parsed.port}`
    : `http://${parsed.hostname}`;

  return url.trim() === expectedWithPort;
}

/**
 * Initialize the settings page: load current config, populate form,
 * attach submit handler for saving.
 */
export async function initSettings(): Promise<void> {
  const config = await loadConfig();

  const endpointInput = document.getElementById("server-endpoint");
  const whitelistTextarea = document.getElementById("whitelist");
  const form = document.getElementById("settings-form");
  const messageDiv = document.getElementById("message");

  if (
    !(endpointInput instanceof HTMLInputElement) ||
    !(whitelistTextarea instanceof HTMLTextAreaElement) ||
    !(form instanceof HTMLFormElement) ||
    !(messageDiv instanceof HTMLDivElement)
  ) {
    return;
  }

  // Populate form with current settings
  endpointInput.value = config.serverEndpoint;
  whitelistTextarea.value = config.whitelist.join("\n");

  // Handle form submission
  form.addEventListener("submit", async (event: Event) => {
    event.preventDefault();

    const endpoint = endpointInput.value.trim();
    const whitelistRaw = whitelistTextarea.value;

    // Validate endpoint
    if (!validateEndpoint(endpoint)) {
      messageDiv.textContent =
        "エンドポイントはlocalhostまたは127.0.0.1のHTTP URLを指定してください";
      messageDiv.className = "error";
      return;
    }

    // Parse whitelist: split by newlines, trim, remove empty entries
    const whitelist = whitelistRaw
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    // Save settings
    try {
      await saveConfig({
        serverEndpoint: endpoint,
        whitelist,
      });
      messageDiv.textContent = "設定を保存しました";
      messageDiv.className = "success";
    } catch {
      messageDiv.textContent =
        "設定の保存に失敗しました。再度お試しください。";
      messageDiv.className = "error";
    }
  });
}

// Auto-initialize when loaded in browser (guard against missing DOM elements)
function autoInit(): void {
  const form = document.getElementById("settings-form");
  if (form) {
    void initSettings().catch(() => {
      const messageDiv = document.getElementById("message");
      if (messageDiv instanceof HTMLDivElement) {
        messageDiv.textContent = "設定の読み込みに失敗しました。";
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
