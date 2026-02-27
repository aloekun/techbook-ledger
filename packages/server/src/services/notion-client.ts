import { Client, APIErrorCode, isNotionClientError } from "@notionhq/client";
import type { BookData } from "@techbook-ledger/shared";

export interface NotionPage {
  readonly id: string;
  readonly url: string;
}

interface NotionBookClientConfig {
  readonly token: string;
  readonly databaseId: string;
  readonly retryDelayMs?: number;
}

const MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 400;

export class NotionAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotionAuthError";
  }
}

export class NotionRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotionRateLimitError";
  }
}

export class NotionConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotionConnectionError";
  }
}

export function buildNotionProperties(
  bookData: BookData,
  registrationDate: Date,
): Record<string, unknown> {
  return {
    ISBN: {
      title: [{ text: { content: bookData.isbn } }],
    },
    タイトル: {
      rich_text: [{ text: { content: bookData.title } }],
    },
    著者: {
      rich_text: [{ text: { content: bookData.author } }],
    },
    出版社: {
      rich_text: [{ text: { content: bookData.publisher } }],
    },
    価格: {
      number: bookData.price,
    },
    発売日: {
      date: { start: bookData.publicationDate },
    },
    ページ数: {
      number: bookData.pageCount,
    },
    登録元URL: {
      url: bookData.sourceUrl,
    },
    登録日時: {
      date: { start: registrationDate.toISOString() },
    },
  };
}

function isRateLimitError(error: unknown): boolean {
  return (
    isNotionClientError(error) &&
    "code" in error &&
    error.code === APIErrorCode.RateLimited
  );
}

function classifyAndThrow(error: unknown): never {
  if (isNotionClientError(error) && "code" in error) {
    const code = (error as { code: string }).code;

    if (code === APIErrorCode.Unauthorized) {
      throw new NotionAuthError(
        "Notion認証に失敗しました。環境変数を確認してください",
      );
    }

    if (code === APIErrorCode.RateLimited) {
      throw new NotionRateLimitError(
        "Notion APIがビジー状態です。しばらく待ってから再試行してください",
      );
    }

    if (code === APIErrorCode.ServiceUnavailable) {
      throw new NotionConnectionError(
        "Notionに接続できません。ネットワーク接続を確認してください",
      );
    }
  }

  throw new NotionConnectionError(
    "Notionに接続できません。ネットワーク接続を確認してください",
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class NotionBookClient {
  private readonly client: Client;
  private readonly databaseId: string;
  private readonly retryDelayMs: number;

  constructor(config: NotionBookClientConfig) {
    this.client = new Client({ auth: config.token });
    this.databaseId = config.databaseId;
    this.retryDelayMs = config.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  }

  async queryByIsbn(isbn: string): Promise<NotionPage | null> {
    const normalizedIsbn = isbn.toLowerCase();

    const response = await this.executeWithRetry(() =>
      this.client.databases.query({
        database_id: this.databaseId,
        filter: {
          property: "ISBN",
          title: {
            equals: normalizedIsbn,
          },
        },
      }),
    );

    if (response.results.length === 0) {
      return null;
    }

    const page = response.results[0] as { id: string; url: string };
    return {
      id: page.id,
      url: page.url,
    };
  }

  async createBookRecord(bookData: BookData): Promise<string> {
    const registrationDate = new Date();
    const properties = buildNotionProperties(bookData, registrationDate);

    const response = await this.executeWithRetry(() =>
      this.client.pages.create({
        parent: { database_id: this.databaseId },
        properties: properties as Parameters<
          typeof this.client.pages.create
        >[0]["properties"],
      }),
    );

    return (response as { url: string }).url;
  }

  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await operation();
      } catch (error: unknown) {
        lastError = error;

        if (!isRateLimitError(error) || attempt === MAX_RETRIES) {
          break;
        }

        const waitMs = this.retryDelayMs * Math.pow(2, attempt);
        await delay(waitMs);
      }
    }

    classifyAndThrow(lastError);
  }
}
