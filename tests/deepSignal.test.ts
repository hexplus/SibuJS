import { describe, expect, it } from "vitest";
import { deepSignal } from "../src/core/signals/deepSignal";
import { effect } from "../src/core/signals/effect";

describe("deepSignal", () => {
  it("should hold initial value", () => {
    const [value] = deepSignal({ name: "Alice", age: 25 });
    expect(value()).toEqual({ name: "Alice", age: 25 });
  });

  it("should not notify when setting structurally identical object", () => {
    const [value, setValue] = deepSignal({ x: 1, y: 2 });
    let calls = 0;

    effect(() => {
      value();
      calls++;
    });

    expect(calls).toBe(1);

    // Set same structure — should not trigger
    setValue({ x: 1, y: 2 });
    expect(calls).toBe(1);
  });

  it("should notify when setting different object", () => {
    const [value, setValue] = deepSignal({ x: 1 });
    let calls = 0;

    effect(() => {
      value();
      calls++;
    });

    expect(calls).toBe(1);

    setValue({ x: 2 });
    expect(calls).toBe(2);
  });

  it("should handle arrays with deep equality", () => {
    const [arr, setArr] = deepSignal([1, 2, 3]);
    let calls = 0;

    effect(() => {
      arr();
      calls++;
    });

    expect(calls).toBe(1);

    // Same array — no notification
    setArr([1, 2, 3]);
    expect(calls).toBe(1);

    // Different array — notification
    setArr([1, 2, 4]);
    expect(calls).toBe(2);
  });
});
