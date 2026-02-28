import type { DuplicateCheckResult } from "@techbook-ledger/shared";
import type { NotionPage } from "./notion-client.js";

export interface IsbnQueryable {
  queryByIsbn(isbn: string): Promise<NotionPage | null>;
}

export async function checkDuplicate(
  isbn: string,
  queryClient: IsbnQueryable,
): Promise<DuplicateCheckResult> {
  const page = await queryClient.queryByIsbn(isbn);

  if (page === null) {
    return { exists: false };
  }

  return {
    exists: true,
    notionPageId: page.id,
    notionUrl: page.url,
  };
}
