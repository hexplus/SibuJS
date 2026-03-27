import { describe, expect, it } from "vitest";
import { memo } from "../src/core/signals/memo";
import { signal } from "../src/core/signals/signal";

describe("memo", () => {
  it("should memoize computed values", () => {
    const [count] = signal(5);
    const doubled = memo(() => count() * 2);
    expect(doubled()).toBe(10);
  });

  it("should recompute when dependencies change", async () => {
    const [count, setCount] = signal(3);
    const doubled = memo(() => count() * 2);

    expect(doubled()).toBe(6);
    setCount(7);
    await Promise.resolve();
    expect(doubled()).toBe(14);
  });
});
