/** Default maximum number of auto-fix retries */
export const DEFAULT_LOOP_LIMIT = 3;

/** Regex pattern to match the loop count marker in PR body */
export const LOOP_COUNT_PATTERN = /<!-- claude-autofix-count:(\d+) -->/;

/** Global regex for replacing all markers in PR body */
const LOOP_COUNT_PATTERN_GLOBAL = /<!-- claude-autofix-count:(\d+) -->/g;

/**
 * Extract the current loop count from a PR body.
 * If multiple markers exist, returns the last one.
 * Returns 0 if no marker is found.
 */
export function extractLoopCount(body: string): number {
  let lastCount = 0;
  let found = false;
  for (const match of body.matchAll(LOOP_COUNT_PATTERN_GLOBAL)) {
    lastCount = parseInt(match[1], 10);
    found = true;
  }
  return found ? lastCount : 0;
}

/**
 * Check whether the loop limit has been reached.
 */
export function isLimitReached(
  count: number,
  limit: number = DEFAULT_LOOP_LIMIT,
): boolean {
  return count >= limit;
}

/**
 * Update (or insert) the loop count marker in the PR body.
 * If a marker already exists, it is replaced with the new count.
 * If no marker exists, one is appended to the end of the body.
 */
export function updateLoopCount(body: string, newCount: number): string {
  if (LOOP_COUNT_PATTERN.test(body)) {
    return body.replaceAll(
      LOOP_COUNT_PATTERN_GLOBAL,
      `<!-- claude-autofix-count:${newCount} -->`,
    );
  }
  return `${body}\n<!-- claude-autofix-count:${newCount} -->`;
}
