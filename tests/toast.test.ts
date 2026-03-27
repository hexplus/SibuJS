import { afterEach, describe, expect, it, vi } from "vitest";
import { toast } from "../src/ui/toast";

describe("toast", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a toast and returns its id", () => {
    vi.useFakeTimers();
    const { toasts, show } = toast({ duration: 0 });

    const id = show("Hello", "info");
    expect(id).toMatch(/^toast-/);
    expect(toasts()).toHaveLength(1);
    expect(toasts()[0].message).toBe("Hello");
    expect(toasts()[0].type).toBe("info");
  });

  it("auto-dismisses after duration", () => {
    vi.useFakeTimers();
    const { toasts, show } = toast({ duration: 1000 });

    show("Temporary");
    expect(toasts()).toHaveLength(1);

    vi.advanceTimersByTime(1000);
    expect(toasts()).toHaveLength(0);
  });

  it("dismisses a specific toast by id", () => {
    vi.useFakeTimers();
    const { toasts, show, dismiss } = toast({ duration: 0 });

    const id1 = show("First");
    const id2 = show("Second");
    expect(toasts()).toHaveLength(2);

    dismiss(id1);
    expect(toasts()).toHaveLength(1);
    expect(toasts()[0].id).toBe(id2);
  });

  it("dismisses all toasts", () => {
    vi.useFakeTimers();
    const { toasts, show, dismissAll } = toast({ duration: 0 });

    show("A");
    show("B");
    show("C");
    expect(toasts()).toHaveLength(3);

    dismissAll();
    expect(toasts()).toHaveLength(0);
  });

  it("enforces maxToasts limit", () => {
    vi.useFakeTimers();
    const { toasts, show } = toast({ duration: 0, maxToasts: 2 });

    show("A");
    show("B");
    show("C");

    expect(toasts()).toHaveLength(2);
    // The oldest should be removed
    expect(toasts()[0].message).toBe("B");
    expect(toasts()[1].message).toBe("C");
  });

  it("defaults type to undefined when not specified", () => {
    vi.useFakeTimers();
    const { toasts, show } = toast({ duration: 0 });

    show("No type");
    expect(toasts()[0].type).toBeUndefined();
  });
});
