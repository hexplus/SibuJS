import { beforeEach, describe, expect, it } from "vitest";
import { removeScopedStyle, scopedStyle, withScopedStyle } from "../src/ui/scopedStyle";

describe("scopedStyle", () => {
  beforeEach(() => {
    for (const el of document.head.querySelectorAll("style[data-sibu-scope]")) el.remove();
  });

  it("should create a scoped style with unique id", () => {
    const { scope, attr } = scopedStyle(".btn { color: red; }");
    expect(scope).toBeTruthy();
    expect(attr).toContain("data-sibu-s");

    const styleEl = document.head.querySelector(`style[data-sibu-scope="${scope}"]`);
    expect(styleEl).not.toBeNull();
  });

  it("should remove scoped style", () => {
    const { scope } = scopedStyle(".test { margin: 0; }");
    expect(document.head.querySelector(`style[data-sibu-scope="${scope}"]`)).not.toBeNull();

    removeScopedStyle(scope);
    expect(document.head.querySelector(`style[data-sibu-scope="${scope}"]`)).toBeNull();
  });
});

describe("withScopedStyle", () => {
  it("should wrap a component with scoped styles", () => {
    const MyComponent = withScopedStyle(".inner { color: blue; }", () => {
      const el = document.createElement("div");
      el.className = "inner";
      return el;
    });

    const el = MyComponent({} as unknown as Record<string, unknown>);
    expect(el.tagName.toLowerCase()).toBe("div");
    // Should have scope attribute
    const attrs = Array.from(el.attributes);
    expect(attrs.some((a) => a.name.startsWith("data-sibu-s"))).toBe(true);
  });
});
