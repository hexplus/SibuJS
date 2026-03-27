import { describe, expect, it } from "vitest";
import { match, show, when } from "../src/core/rendering/directives";
import { signal } from "../src/core/signals/signal";

describe("show", () => {
  it("should toggle display based on condition", () => {
    const [visible, setVisible] = signal(true);
    const el = document.createElement("div");
    el.textContent = "Hello";

    show(() => visible(), el);

    expect(el.style.display).toBe("");

    setVisible(false);
    expect(el.style.display).toBe("none");

    setVisible(true);
    expect(el.style.display).toBe("");
  });
});

describe("when", () => {
  it("should render then branch when true", async () => {
    const [flag] = signal(true);
    const container = document.createElement("div");
    const anchor = when(
      () => flag(),
      () => {
        const s = document.createElement("span");
        s.textContent = "Yes";
        return s;
      },
      () => {
        const s = document.createElement("span");
        s.textContent = "No";
        return s;
      },
    );
    container.appendChild(anchor);
    document.body.appendChild(container);

    await new Promise((r) => setTimeout(r, 10));

    expect(container.textContent).toContain("Yes");

    document.body.removeChild(container);
  });
});

describe("match", () => {
  it("should render matching case", async () => {
    const [status] = signal<string>("loading");
    const container = document.createElement("div");
    const anchor = match(() => status(), {
      loading: () => {
        const s = document.createElement("span");
        s.textContent = "Loading...";
        return s;
      },
      done: () => {
        const s = document.createElement("span");
        s.textContent = "Done!";
        return s;
      },
    });
    container.appendChild(anchor);
    document.body.appendChild(container);

    await new Promise((r) => setTimeout(r, 10));

    expect(container.textContent).toContain("Loading...");

    document.body.removeChild(container);
  });
});
