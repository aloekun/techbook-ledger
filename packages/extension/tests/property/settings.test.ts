import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { validateEndpoint } from "../../src/settings/settings.js";

// Arbitraries for generating valid localhost URLs
const validPortArb = fc.integer({ min: 1, max: 65535 });

const validLocalhostEndpointArb = fc.oneof(
  validPortArb.map((port) => `http://localhost:${port}`),
  validPortArb.map((port) => `http://127.0.0.1:${port}`),
);

const validLocalhostNoPortArb = fc.constantFrom(
  "http://localhost",
  "http://127.0.0.1",
);

const validEndpointArb = fc.oneof(
  validLocalhostEndpointArb,
  validLocalhostNoPortArb,
);

// Arbitraries for generating invalid URLs

// Non-localhost hostnames
const nonLocalhostHostArb = fc
  .tuple(
    fc.stringOf(
      fc.constantFrom(...("abcdefghijklmnopqrstuvwxyz".split(""))),
      { minLength: 2, maxLength: 10 },
    ),
    fc.constantFrom(".com", ".co.jp", ".jp", ".org", ".net", ".io"),
  )
  .map(([name, tld]) => name + tld);

const nonLocalhostUrlArb = fc
  .tuple(nonLocalhostHostArb, validPortArb)
  .map(([host, port]) => `http://${host}:${port}`);

// HTTPS URLs (not allowed for localhost)
const httpsLocalhostArb = fc.oneof(
  validPortArb.map((port) => `https://localhost:${port}`),
  validPortArb.map((port) => `https://127.0.0.1:${port}`),
);

// Non-URL strings
const nonUrlArb = fc.oneof(
  fc.constant(""),
  fc.constant("not-a-url"),
  fc.constant("ftp://localhost:3000"),
  fc.stringOf(
    fc.constantFrom(...("abcdefghijklmnopqrstuvwxyz0123456789".split(""))),
    { minLength: 1, maxLength: 20 },
  ),
);

describe("Feature: tech-book-decision-support, Property 19: エンドポイント形式検証", () => {
  it("should accept all valid localhost HTTP URLs", async () => {
    await fc.assert(
      fc.asyncProperty(validEndpointArb, async (url) => {
        expect(validateEndpoint(url)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("should reject all non-localhost URLs", async () => {
    await fc.assert(
      fc.asyncProperty(nonLocalhostUrlArb, async (url) => {
        expect(validateEndpoint(url)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it("should reject all HTTPS localhost URLs", async () => {
    await fc.assert(
      fc.asyncProperty(httpsLocalhostArb, async (url) => {
        expect(validateEndpoint(url)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it("should reject all non-URL strings", async () => {
    await fc.assert(
      fc.asyncProperty(nonUrlArb, async (input) => {
        expect(validateEndpoint(input)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});
