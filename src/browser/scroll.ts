import { signal } from "../core/signals/signal";
import { batch } from "../reactivity/batch";

/**
 * scroll tracks the scroll position of a target element or the window.
 * Returns reactive x/y scroll positions and an isScrolling indicator
 * that resets after 150ms of inactivity.
 *
 * @param target Optional reactive getter for the scroll target element.
 *               If omitted or returns null, tracks window scroll.
 * @returns Object with reactive x, y, isScrolling getters and a dispose function
 */
export function scroll(target?: () => HTMLElement | null): {
  x: () => number;
  y: () => number;
  isScrolling: () => boolean;
  dispose: () => void;
} {
  const [x, setX] = signal(0);
  const [y, setY] = signal(0);
  const [isScrolling, setIsScrolling] = signal(false);
  let scrollTimer: ReturnType<typeof setTimeout> | null = null;

  if (typeof window === "undefined") {
    return { x, y, isScrolling, dispose: () => {} };
  }

  const handler = () => {
    const el = target ? target() : null;
    batch(() => {
      if (el) {
        setX(el.scrollLeft);
        setY(el.scrollTop);
      } else {
        setX(window.scrollX ?? window.pageXOffset ?? 0);
        setY(window.scrollY ?? window.pageYOffset ?? 0);
      }
      setIsScrolling(true);
    });

    if (scrollTimer !== null) clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      setIsScrolling(false);
      scrollTimer = null;
    }, 150);
  };

  const scrollTarget = target ? target() : null;
  const eventTarget = scrollTarget || window;
  eventTarget.addEventListener("scroll", handler, { passive: true });

  function dispose() {
    eventTarget.removeEventListener("scroll", handler);
    if (scrollTimer !== null) {
      clearTimeout(scrollTimer);
      scrollTimer = null;
    }
  }

  return { x, y, isScrolling, dispose };
}
