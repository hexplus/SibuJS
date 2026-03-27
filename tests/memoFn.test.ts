import { describe, expect, it } from "vitest";
import { memoFn } from "../src/core/signals/memoFn";
import { signal } from "../src/core/signals/signal";

describe("memoFn", () => {
  it("should return a memoized callback", () => {
    const [multiplier] = signal(2);
    const multiply = memoFn(() => (x: number) => x * multiplier());

    const fn = multiply();
    expect(fn(5)).toBe(10);
  });

  it("should update callback when dependencies change", async () => {
    const [multiplier, setMultiplier] = signal(2);
    const multiply = memoFn(() => (x: number) => x * multiplier());

    expect(multiply()(4)).toBe(8);

    setMultiplier(3);
    await Promise.resolve();

    expect(multiply()(4)).toBe(12);
  });
});
