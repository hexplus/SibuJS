import { signal } from "../core/signals/signal";

/**
 * dialog provides reactive dialog state management with escape-to-close support.
 *
 * Call `dispose()` when the owning component unmounts to ensure the global
 * keydown listener is removed even if the dialog is still open.
 */
export function dialog(): {
  open: () => void;
  close: () => void;
  isOpen: () => boolean;
  toggle: () => void;
  dispose: () => void;
} {
  const [isOpen, setIsOpen] = signal(false);
  let listenerAttached = false;

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      close();
    }
  }

  function attachListener(): void {
    if (typeof window !== "undefined" && !listenerAttached) {
      window.addEventListener("keydown", handleKeydown);
      listenerAttached = true;
    }
  }

  function detachListener(): void {
    if (typeof window !== "undefined" && listenerAttached) {
      window.removeEventListener("keydown", handleKeydown);
      listenerAttached = false;
    }
  }

  function open(): void {
    setIsOpen(true);
    attachListener();
  }

  function close(): void {
    setIsOpen(false);
    detachListener();
  }

  function toggle(): void {
    if (isOpen()) close();
    else open();
  }

  function dispose(): void {
    detachListener();
    setIsOpen(false);
  }

  return { open, close, isOpen, toggle, dispose };
}
