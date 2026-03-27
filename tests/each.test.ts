import { describe, expect, it } from "vitest";
import { each } from "../src/core/rendering/each";
import { signal } from "../src/core/signals/signal";

describe("each", () => {
  it("should render items and update DOM when array changes", async () => {
    const [list, setList] = signal([
      { id: 1, name: "One" },
      { id: 2, name: "Two" },
    ]);

    const container = document.createElement("div");
    const anchor = each(
      list,
      (item) => {
        const el = document.createElement("div");
        el.textContent = item.name;
        return el;
      },
      { key: (item) => item.id },
    );
    container.appendChild(anchor);

    await Promise.resolve(); // allow initial render
    expect(container.textContent).toBe("OneTwo");

    setList([
      { id: 2, name: "Two" },
      { id: 3, name: "Three" },
    ]);

    await Promise.resolve(); // allow update
    expect(container.textContent).toBe("TwoThree");
  });
});
