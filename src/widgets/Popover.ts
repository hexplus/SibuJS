import { signal } from "../core/signals/signal";

/**
 * popover provides simple state management for positioned floating content.
 * Manages open/close/toggle without any DOM coupling.
 */
export function popover(): {
  isOpen: () => boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
} {
  const [isOpen, setIsOpen] = signal<boolean>(false);

  function open(): void {
    setIsOpen(true);
  }

  function close(): void {
    setIsOpen(false);
  }

  function toggle(): void {
    setIsOpen((prev) => !prev);
  }

  return { isOpen, open, close, toggle };
}
