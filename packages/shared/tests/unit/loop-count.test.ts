import { describe, it, expect } from "vitest";
import {
  extractLoopCount,
  isLimitReached,
  updateLoopCount,
  LOOP_COUNT_PATTERN,
  DEFAULT_LOOP_LIMIT,
} from "../../src/utils/loop-count.js";

describe("extractLoopCount", () => {
  it("should return 0 when body has no count marker", () => {
    expect(extractLoopCount("Some PR description")).toBe(0);
  });

  it("should return 0 when body is empty string", () => {
    expect(extractLoopCount("")).toBe(0);
  });

  it("should extract count from marker at end of body", () => {
    const body = "PR description\n<!-- claude-autofix-count:2 -->";
    expect(extractLoopCount(body)).toBe(2);
  });

  it("should extract count from marker in middle of body", () => {
    const body = "Before\n<!-- claude-autofix-count:5 -->\nAfter";
    expect(extractLoopCount(body)).toBe(5);
  });

  it("should extract count 0 from marker", () => {
    const body = "Body\n<!-- claude-autofix-count:0 -->";
    expect(extractLoopCount(body)).toBe(0);
  });

  it("should handle multi-digit counts", () => {
    const body = "Body\n<!-- claude-autofix-count:15 -->";
    expect(extractLoopCount(body)).toBe(15);
  });

  it("should return 0 for malformed marker (missing digits)", () => {
    const body = "Body\n<!-- claude-autofix-count: -->";
    expect(extractLoopCount(body)).toBe(0);
  });

  it("should return 0 for partial marker text", () => {
    const body = "Body\nclaude-autofix-count:3";
    expect(extractLoopCount(body)).toBe(0);
  });

  it("should return last count when multiple markers exist", () => {
    const body =
      "Body\n<!-- claude-autofix-count:1 -->\n<!-- claude-autofix-count:2 -->";
    expect(extractLoopCount(body)).toBe(2);
  });
});

describe("isLimitReached", () => {
  it("should return false when count is 0", () => {
    expect(isLimitReached(0)).toBe(false);
  });

  it("should return false when count is below limit", () => {
    expect(isLimitReached(2)).toBe(false);
  });

  it("should return true when count equals limit", () => {
    expect(isLimitReached(3)).toBe(true);
  });

  it("should return true when count exceeds limit", () => {
    expect(isLimitReached(5)).toBe(true);
  });

  it("should use custom limit when provided", () => {
    expect(isLimitReached(2, 2)).toBe(true);
    expect(isLimitReached(1, 2)).toBe(false);
  });
});

describe("updateLoopCount", () => {
  it("should append marker when body has no existing marker", () => {
    const result = updateLoopCount("PR description", 1);
    expect(result).toBe("PR description\n<!-- claude-autofix-count:1 -->");
  });

  it("should replace existing marker with new count", () => {
    const body = "PR description\n<!-- claude-autofix-count:2 -->";
    const result = updateLoopCount(body, 3);
    expect(result).toBe("PR description\n<!-- claude-autofix-count:3 -->");
  });

  it("should replace marker in middle of body preserving surrounding text", () => {
    const body = "Before\n<!-- claude-autofix-count:1 -->\nAfter";
    const result = updateLoopCount(body, 2);
    expect(result).toBe("Before\n<!-- claude-autofix-count:2 -->\nAfter");
  });

  it("should handle empty body by creating marker", () => {
    const result = updateLoopCount("", 1);
    expect(result).toBe("\n<!-- claude-autofix-count:1 -->");
  });

  it("should handle count of 0", () => {
    const result = updateLoopCount("Body", 0);
    expect(result).toBe("Body\n<!-- claude-autofix-count:0 -->");
  });

  it("should replace all markers when multiple exist", () => {
    const body =
      "Body\n<!-- claude-autofix-count:1 -->\nMiddle\n<!-- claude-autofix-count:1 -->";
    const result = updateLoopCount(body, 2);
    expect(result).not.toContain("claude-autofix-count:1");
    expect(result).toContain("<!-- claude-autofix-count:2 -->");
  });
});

describe("LOOP_COUNT_PATTERN", () => {
  it("should match valid marker format", () => {
    expect(LOOP_COUNT_PATTERN.test("<!-- claude-autofix-count:3 -->")).toBe(
      true,
    );
  });

  it("should not match without HTML comment delimiters", () => {
    expect(LOOP_COUNT_PATTERN.test("claude-autofix-count:3")).toBe(false);
  });

  it("should capture the digit group", () => {
    const match = "<!-- claude-autofix-count:7 -->".match(LOOP_COUNT_PATTERN);
    expect(match).not.toBeNull();
    expect(match![1]).toBe("7");
  });
});

describe("DEFAULT_LOOP_LIMIT", () => {
  it("should be 3", () => {
    expect(DEFAULT_LOOP_LIMIT).toBe(3);
  });
});
