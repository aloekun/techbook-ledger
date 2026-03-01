import { DEFAULT_WHITELIST } from "@techbook-ledger/shared";

/**
 * 単一のワイルドカードパターンがホスト名にマッチするかを判定する
 *
 * サポートするパターン形式:
 * - 完全一致: "amazon.co.jp" は "amazon.co.jp" のみにマッチ
 * - ワイルドカード: "*.amazon.co.jp" は "www.amazon.co.jp" などサブドメイン付きにマッチ
 *   （"amazon.co.jp" 自体にはマッチしない）
 *
 * @param hostname - チェック対象のホスト名（例: "www.amazon.co.jp"）
 * @param pattern - ドメインパターン（例: "*.amazon.co.jp"）
 * @returns マッチする場合 true
 */
export function matchesWhitelistPattern(hostname: string, pattern: string): boolean {
  const normalizedHostname = hostname.toLowerCase();
  const normalizedPattern = pattern.toLowerCase();

  if (normalizedPattern.startsWith("*.")) {
    // ワイルドカードパターン: "*.domain" は "sub.domain" にマッチ
    // ただし "domain" 自体にはマッチしない
    const suffix = normalizedPattern.slice(1); // ".domain" 部分
    return (
      normalizedHostname.endsWith(suffix) &&
      normalizedHostname.length > suffix.length
    );
  }

  // 完全一致
  return normalizedHostname === normalizedPattern;
}

/**
 * ホスト名がホワイトリストに含まれるかを判定する
 *
 * ホワイトリスト内のいずれかのパターンにマッチすれば true を返す。
 * パターンには完全一致とワイルドカード（*.domain）の両方を使用できる。
 *
 * @param hostname - チェック対象のホスト名
 * @param whitelist - ドメインパターンの配列（省略時はデフォルトホワイトリストを使用）
 * @returns ホワイトリストに含まれる場合 true
 */
export function isWhitelistedSite(
  hostname: string,
  whitelist: readonly string[] = DEFAULT_WHITELIST,
): boolean {
  return whitelist.some((pattern) => matchesWhitelistPattern(hostname, pattern));
}
