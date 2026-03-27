import { describe, expect, it } from "vitest";
import { store } from "../src/core/signals/store";

describe("store", () => {
  it("initializes with the provided state and updates via setState", () => {
    const [s, { setState }] = store({ count: 0, text: "hello" });

    // initial values
    expect(s.count).toBe(0);
    expect(s.text).toBe("hello");

    // patch with object
    setState({ count: 5 });
    expect(s.count).toBe(5);
    expect(s.text).toBe("hello");

    // patch with updater function
    setState((s) => ({ ...s, text: "world" }));
    expect(s.count).toBe(5);
    expect(s.text).toBe("world");
  });

  it("resets to the initial state", () => {
    const [s, { setState, reset }] = store({ foo: 1 });
    setState({ foo: 42 });
    expect(s.foo).toBe(42);

    reset();
    expect(s.foo).toBe(1);
  });
});
