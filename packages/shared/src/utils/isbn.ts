/**
 * ISBNを正規化する（ハイフン・空白を除去し、末尾の小文字'x'を大文字'X'に統一する）
 */
export function normalizeIsbn(isbn: string): string {
  const stripped = isbn.replace(/[\s-]/g, "");
  // ISBN-10の末尾xを大文字Xに統一
  if (stripped.length > 0 && stripped[stripped.length - 1] === "x") {
    return stripped.slice(0, -1) + "X";
  }
  return stripped;
}
