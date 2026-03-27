import { describe, expect, it } from "vitest";
import { createEffect, createMemo, createSignal } from "../src/patterns/primitives";

describe("createSignal", () => {
  it("should create a reactive signal", () => {
    const [count, setCount] = createSignal(0);
    expect(count()).toBe(0);
    setCount(5);
    expect(count()).toBe(5);
  });

  it("should support updater function", () => {
    const [val, setVal] = createSignal(10);
    setVal((prev) => prev + 5);
    expect(val()).toBe(15);
  });
});

describe("createMemo", () => {
  it("should derive values from signals", async () => {
    const [a, setA] = createSignal(3);
    const doubled = createMemo(() => a() * 2);
    expect(doubled()).toBe(6);

    setA(7);
    await Promise.resolve();
    expect(doubled()).toBe(14);
  });
});

describe("createEffect", () => {
  it("should run effect on dependency change", () => {
    const [count, setCount] = createSignal(0);
    let observed = -1;

    createEffect(() => {
      observed = count();
    });

    expect(observed).toBe(0);
    setCount(42);
    expect(observed).toBe(42);
  });
});
