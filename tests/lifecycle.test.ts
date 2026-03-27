import { describe, expect, it, vi } from "vitest";
import { onMount, onUnmount } from "../src/core/rendering/lifecycle";

describe("onMount", () => {
  it("should call callback via microtask when no element specified", async () => {
    const cb = vi.fn();
    onMount(cb);

    expect(cb).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(cb).toHaveBeenCalledOnce();
  });

  it("should call callback when element is already connected", async () => {
    const el = document.createElement("div");
    document.body.appendChild(el);

    const cb = vi.fn();
    onMount(cb, el);

    await Promise.resolve();
    expect(cb).toHaveBeenCalledOnce();

    document.body.removeChild(el);
  });
});

describe("onUnmount", () => {
  it("should call callback when element is removed from DOM", async () => {
    const el = document.createElement("div");
    document.body.appendChild(el);

    const cb = vi.fn();
    onUnmount(cb, el);

    // Give observer time to start
    await new Promise((r) => setTimeout(r, 10));

    document.body.removeChild(el);

    // MutationObserver is async
    await new Promise((r) => setTimeout(r, 50));

    expect(cb).toHaveBeenCalledOnce();
  });
});
