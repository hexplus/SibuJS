import { signal } from "../core/signals/signal";

/**
 * reducedMotion returns a reactive boolean tracking whether the user
 * prefers reduced motion via the `prefers-reduced-motion` media query.
 */
export function reducedMotion(): { reduced: () => boolean; dispose: () => void } {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    const [reduced] = signal(false);
    return { reduced, dispose: () => {} };
  }

  const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
  const [reduced, setReduced] = signal(mql.matches);

  const handler = (event: MediaQueryListEvent) => {
    setReduced(event.matches);
  };

  mql.addEventListener("change", handler);

  function dispose() {
    mql.removeEventListener("change", handler);
  }

  return { reduced, dispose };
}
