import { beforeEach, describe, expect, it } from "vitest";
import { persisted } from "../src/patterns/persist";

describe("persisted", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("should use initial value when no persisted data", () => {
    const [value] = persisted("test-key", "default");
    expect(value()).toBe("default");
  });

  it("should persist value to localStorage on change", () => {
    const [, setValue] = persisted("counter", 0);
    setValue(42);
    expect(JSON.parse(localStorage.getItem("counter") ?? "null")).toBe(42);
  });

  it("should restore persisted value on init", () => {
    localStorage.setItem("name", JSON.stringify("Alice"));
    const [value] = persisted("name", "default");
    expect(value()).toBe("Alice");
  });

  it("should use sessionStorage when session option is true", () => {
    const [, setValue] = persisted("session-key", "a", { session: true });
    setValue("b");
    expect(JSON.parse(sessionStorage.getItem("session-key") ?? "null")).toBe("b");
    expect(localStorage.getItem("session-key")).toBeNull();
  });
});
