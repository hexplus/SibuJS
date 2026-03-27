import { signal } from "../core/signals/signal";

/**
 * contentEditable provides reactive binding for contenteditable elements.
 * Commands call document.execCommand with browser API guards for Node environments.
 */
export function contentEditable(): {
  content: () => string;
  setContent: (html: string) => void;
  isFocused: () => boolean;
  setFocused: (v: boolean) => void;
  execCommand: (command: string, value?: string) => void;
  bold: () => void;
  italic: () => void;
  underline: () => void;
} {
  const [content, setContent] = signal<string>("");
  const [isFocused, setFocused] = signal<boolean>(false);

  function execCommand(command: string, value?: string): void {
    if (typeof document !== "undefined" && document.execCommand) {
      document.execCommand(command, false, value ?? "");
    }
  }

  function bold(): void {
    execCommand("bold");
  }

  function italic(): void {
    execCommand("italic");
  }

  function underline(): void {
    execCommand("underline");
  }

  return {
    content,
    setContent,
    isFocused,
    setFocused,
    execCommand,
    bold,
    italic,
    underline,
  };
}
