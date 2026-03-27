import { afterEach, describe, expect, it, vi } from "vitest";
import { contentEditable } from "../src/widgets/contentEditable";

describe("contentEditable", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function setupDocument(): ReturnType<typeof vi.fn> {
    const execCommandMock = vi.fn();
    vi.stubGlobal("document", {
      execCommand: execCommandMock,
    });
    return execCommandMock;
  }

  it("starts with empty content and not focused", () => {
    const editor = contentEditable();
    expect(editor.content()).toBe("");
    expect(editor.isFocused()).toBe(false);
  });

  it("sets and reads content", () => {
    const editor = contentEditable();
    editor.setContent("<b>Hello</b>");
    expect(editor.content()).toBe("<b>Hello</b>");
  });

  it("tracks focus state", () => {
    const editor = contentEditable();
    editor.setFocused(true);
    expect(editor.isFocused()).toBe(true);
    editor.setFocused(false);
    expect(editor.isFocused()).toBe(false);
  });

  it("calls document.execCommand for bold, italic, underline", () => {
    const execCommandMock = setupDocument();
    const editor = contentEditable();

    editor.bold();
    expect(execCommandMock).toHaveBeenCalledWith("bold", false, "");

    editor.italic();
    expect(execCommandMock).toHaveBeenCalledWith("italic", false, "");

    editor.underline();
    expect(execCommandMock).toHaveBeenCalledWith("underline", false, "");
  });

  it("execCommand passes custom command and value", () => {
    const execCommandMock = setupDocument();
    const editor = contentEditable();

    editor.execCommand("foreColor", "red");
    expect(execCommandMock).toHaveBeenCalledWith("foreColor", false, "red");
  });

  it("does not throw when document is unavailable", () => {
    // In Node test env, document may not exist
    vi.stubGlobal("document", undefined);
    const editor = contentEditable();
    expect(() => editor.bold()).not.toThrow();
  });
});
