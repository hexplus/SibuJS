import { signal } from "../core/signals/signal";

/**
 * dialog provides reactive dialog state management with escape-to-close support.
 */
export function dialog(): {
  open: () => void;
  close: () => void;
  isOpen: () => boolean;
  toggle: () => void;
} {
  const [isOpen, setIsOpen] = signal(false);
  let listenerAttached = false;

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      close();
    }
  }

  function open(): void {
    setIsOpen(true);
    if (typeof window !== "undefined" && !listenerAttached) {
      window.addEventListener("keydown", handleKeydown);
      listenerAttached = true;
    }
  }

  function close(): void {
    setIsOpen(false);
    if (typeof window !== "undefined" && listenerAttached) {
      window.removeEventListener("keydown", handleKeydown);
      listenerAttached = false;
    }
  }

  function toggle(): void {
    if (isOpen()) {
      close();
    } else {
      open();
    }
  }

  return { open, close, isOpen, toggle };
}
