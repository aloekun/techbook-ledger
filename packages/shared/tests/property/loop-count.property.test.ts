import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  extractLoopCount,
  isLimitReached,
  updateLoopCount,
  DEFAULT_LOOP_LIMIT,
} from "../../src/utils/loop-count.js";

// --- Generators ---

/** Non-negative integer for loop count */
const countGen = fc.integer({ min: 0, max: 100 });

/** Arbitrary PR body text that does not contain the marker keyword */
const bodyWithoutMarkerGen = fc
  .string()
  .filter((s) => !s.includes("claude-autofix-count:"));

// --- Property Tests ---

describe("Loop Count Properties", () => {
  it("extractLoopCount returns 0 for any body without a marker", () => {
    fc.assert(
      fc.property(bodyWithoutMarkerGen, (body) => {
        expect(extractLoopCount(body)).toBe(0);
      }),
      { numRuns: 100 },
    );
  });

  it("extractLoopCount correctly extracts the count from a body with a marker", () => {
    fc.assert(
      fc.property(
        bodyWithoutMarkerGen,
        countGen,
        bodyWithoutMarkerGen,
        (before, count, after) => {
          const body = `${before}\n<!-- claude-autofix-count:${count} -->\n${after}`;
          expect(extractLoopCount(body)).toBe(count);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("roundtrip: updateLoopCount followed by extractLoopCount returns the updated count", () => {
    fc.assert(
      fc.property(bodyWithoutMarkerGen, countGen, (body, count) => {
        const updated = updateLoopCount(body, count);
        expect(extractLoopCount(updated)).toBe(count);
      }),
      { numRuns: 100 },
    );
  });

  it("updateLoopCount is idempotent for the same count", () => {
    fc.assert(
      fc.property(bodyWithoutMarkerGen, countGen, (body, count) => {
        const first = updateLoopCount(body, count);
        const second = updateLoopCount(first, count);
        expect(second).toBe(first);
      }),
      { numRuns: 100 },
    );
  });

  it("isLimitReached returns true iff count >= limit", () => {
    fc.assert(
      fc.property(
        countGen,
        fc.integer({ min: 1, max: 50 }),
        (count, limit) => {
          expect(isLimitReached(count, limit)).toBe(count >= limit);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("isLimitReached uses DEFAULT_LOOP_LIMIT when no limit is provided", () => {
    fc.assert(
      fc.property(countGen, (count) => {
        expect(isLimitReached(count)).toBe(count >= DEFAULT_LOOP_LIMIT);
      }),
      { numRuns: 100 },
    );
  });

  it("updateLoopCount preserves the original body content", () => {
    fc.assert(
      fc.property(bodyWithoutMarkerGen, countGen, (body, count) => {
        const updated = updateLoopCount(body, count);
        expect(updated).toContain(body);
      }),
      { numRuns: 100 },
    );
  });
});
