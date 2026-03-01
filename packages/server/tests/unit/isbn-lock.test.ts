import { describe, it, expect } from "vitest";
import { withIsbnLock } from "../../src/utils/isbn-lock.js";

describe("withIsbnLock", () => {
  it("should execute the function and return its result", async () => {
    const result = await withIsbnLock("9784297138189", async () => "done");
    expect(result).toBe("done");
  });

  it("should serialize concurrent calls with the same ISBN", async () => {
    const order: number[] = [];

    const task1 = withIsbnLock("9784297138189", async () => {
      order.push(1);
      await new Promise((r) => setTimeout(r, 50));
      order.push(2);
      return "first";
    });

    const task2 = withIsbnLock("9784297138189", async () => {
      order.push(3);
      return "second";
    });

    const [result1, result2] = await Promise.all([task1, task2]);

    expect(result1).toBe("first");
    expect(result2).toBe("second");
    // task1 must fully complete before task2 starts
    expect(order).toEqual([1, 2, 3]);
  });

  it("should allow concurrent calls with different ISBNs", async () => {
    const order: string[] = [];

    const task1 = withIsbnLock("isbn-a", async () => {
      order.push("a-start");
      await new Promise((r) => setTimeout(r, 50));
      order.push("a-end");
      return "a";
    });

    const task2 = withIsbnLock("isbn-b", async () => {
      order.push("b-start");
      await new Promise((r) => setTimeout(r, 10));
      order.push("b-end");
      return "b";
    });

    const [result1, result2] = await Promise.all([task1, task2]);

    expect(result1).toBe("a");
    expect(result2).toBe("b");
    // b should finish before a (shorter delay), proving they run in parallel
    expect(order.indexOf("b-end")).toBeLessThan(order.indexOf("a-end"));
  });

  it("should release lock even if function throws", async () => {
    await expect(
      withIsbnLock("9784297138189", async () => {
        throw new Error("test error");
      }),
    ).rejects.toThrow("test error");

    // Lock should be released - next call should succeed immediately
    const result = await withIsbnLock("9784297138189", async () => "recovered");
    expect(result).toBe("recovered");
  });

  it("should normalize lock keys case-insensitively", async () => {
    const order: number[] = [];

    const task1 = withIsbnLock("4-87311-336-X", async () => {
      order.push(1);
      await new Promise((r) => setTimeout(r, 30));
      order.push(2);
      return "first";
    });

    const task2 = withIsbnLock("4-87311-336-x", async () => {
      order.push(3);
      return "second";
    });

    await Promise.all([task1, task2]);

    expect(order).toEqual([1, 2, 3]);
  });
});
