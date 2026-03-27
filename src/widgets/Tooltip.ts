import { signal } from "../core/signals/signal";

/**
 * tooltip manages tooltip visibility with optional show delay.
 * Timer cleanup is handled via closure variables per the framework convention.
 */
export function tooltip(options?: { delay?: number }): {
  isVisible: () => boolean;
  show: () => void;
  hide: () => void;
  content: () => string;
  setContent: (text: string) => void;
} {
  const delay = options?.delay ?? 0;

  const [isVisible, setIsVisible] = signal<boolean>(false);
  const [content, setContent] = signal<string>("");

  let delayTimer: ReturnType<typeof setTimeout> | null = null;

  function show(): void {
    if (delay > 0) {
      // Clear any pending timer before scheduling a new one
      if (delayTimer !== null) {
        clearTimeout(delayTimer);
      }
      delayTimer = setTimeout(() => {
        setIsVisible(true);
        delayTimer = null;
      }, delay);
    } else {
      setIsVisible(true);
    }
  }

  function hide(): void {
    // Clear any pending show timer
    if (delayTimer !== null) {
      clearTimeout(delayTimer);
      delayTimer = null;
    }
    setIsVisible(false);
  }

  return { isVisible, show, hide, content, setContent };
}
