import { describe, expect, it } from "vitest";
import { optimistic, optimisticList } from "../src/patterns/optimistic";

describe("optimistic", () => {
  it("should initialize with value", () => {
    const [value] = optimistic("hello");
    expect(value()).toBe("hello");
  });

  it("should apply optimistic value immediately", async () => {
    const [value, addOptimistic] = optimistic("initial");

    const promise = addOptimistic("optimistic", async () => {
      return "confirmed";
    });

    // Value should be optimistic immediately
    expect(value()).toBe("optimistic");

    await promise;
    expect(value()).toBe("confirmed");
  });

  it("should revert on failure", async () => {
    const [value, addOptimistic] = optimistic("initial");

    const promise = addOptimistic("optimistic", async () => {
      throw new Error("fail");
    });

    expect(value()).toBe("optimistic");

    await promise;
    expect(value()).toBe("initial"); // Reverted
  });
});

describe("optimisticList", () => {
  it("should add items optimistically", async () => {
    const { items, addOptimistic } = optimisticList([1, 2, 3]);

    await addOptimistic(4, async () => 4);
    expect(items()).toEqual([1, 2, 3, 4]);
  });

  it("should revert added items on failure", async () => {
    const { items, addOptimistic } = optimisticList([1, 2, 3]);

    await addOptimistic(4, async () => {
      throw new Error("fail");
    });

    expect(items()).toEqual([1, 2, 3]);
  });

  it("should remove items optimistically", async () => {
    const { items, removeOptimistic } = optimisticList([1, 2, 3]);

    await removeOptimistic(
      (item) => item === 2,
      async () => {},
    );
    expect(items()).toEqual([1, 3]);
  });
});
