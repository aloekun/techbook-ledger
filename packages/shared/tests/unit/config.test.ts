import { describe, it, expect } from "vitest";
import {
  DEFAULT_WHITELIST,
  DEFAULT_EXTENSION_CONFIG,
} from "../../src/types/config.js";

describe("DEFAULT_WHITELIST", () => {
  it("should contain amazon.co.jp", () => {
    expect(DEFAULT_WHITELIST).toContain("amazon.co.jp");
  });

  it("should contain gihyo.jp", () => {
    expect(DEFAULT_WHITELIST).toContain("gihyo.jp");
  });

  it("should contain wildcard for amazon.co.jp subdomains", () => {
    expect(DEFAULT_WHITELIST).toContain("*.amazon.co.jp");
  });

  it("should have exactly 3 entries", () => {
    expect(DEFAULT_WHITELIST).toHaveLength(3);
  });
});

describe("DEFAULT_EXTENSION_CONFIG", () => {
  it("should have localhost:3000 as default server endpoint", () => {
    expect(DEFAULT_EXTENSION_CONFIG.serverEndpoint).toBe(
      "http://localhost:3000",
    );
  });

  it("should use DEFAULT_WHITELIST as default whitelist", () => {
    expect(DEFAULT_EXTENSION_CONFIG.whitelist).toBe(DEFAULT_WHITELIST);
  });
});
