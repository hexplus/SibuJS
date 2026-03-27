import { signal } from "../signals/signal";
import { div, span } from "./html";

type Component = () => HTMLElement;
type LazyImport = () => Promise<{ default: Component }>;

/**
 * lazy() enables code-splitting by deferring the import of a component
 * until it is first rendered. Returns a wrapper component that shows a
 * loading state while the import resolves.
 *
 * @example
 * ```ts
 * const LazyDashboard = lazy(() => import("./Dashboard"));
 *
 * // Use inside Suspense for custom loading UI
 * Suspense({
 *   nodes: () => LazyDashboard(),
 *   fallback: () => div({ nodes: "Loading dashboard..." }),
 * });
 *
 * // Or use standalone — shows default "Loading..." text
 * LazyDashboard();
 * ```
 *
 * @param importFn Dynamic import function returning `{ default: Component }`
 * @returns A component function that lazy-loads on first call
 */
export function lazy(importFn: LazyImport): Component {
  let cached: Component | null = null;

  return function LazyComponent(): HTMLElement {
    // If already loaded, render immediately
    if (cached) {
      return cached();
    }

    const [_status, setStatus] = signal<"loading" | "loaded" | "error">("loading");
    const [_error, setError] = signal<Error | null>(null);
    const container = div({ class: "sibu-lazy" }) as HTMLElement;

    importFn()
      .then((mod) => {
        cached = mod.default;
        const rendered = cached();
        container.replaceChildren(rendered);
        setStatus("loaded");
      })
      .catch((err) => {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        setStatus("error");
        container.replaceChildren(
          div({
            class: "sibu-lazy-error",
            nodes: `Failed to load component: ${errorObj.message}`,
          }),
        );
      });

    // Show loading placeholder initially
    container.appendChild(span({ class: "sibu-lazy-loading", nodes: "Loading..." }));

    return container;
  };
}

/**
 * Suspense provides a fallback UI while lazy or async nodes are loading.
 *
 * @example
 * ```ts
 * Suspense({
 *   nodes: () => LazyChart(),
 *   fallback: () => div({ nodes: "Loading chart..." }),
 * });
 * ```
 *
 * @param props.nodes Function that returns the async/lazy component
 * @param props.fallback Function that returns the loading UI
 * @returns An HTMLElement that swaps from fallback to content when ready
 */
export interface SuspenseProps {
  nodes: () => HTMLElement;
  fallback: () => HTMLElement;
}

export function Suspense({ nodes, fallback }: SuspenseProps): HTMLElement {
  const container = div({ class: "sibu-suspense" }) as HTMLElement;

  // Show fallback immediately
  const fallbackEl = fallback();
  container.appendChild(fallbackEl);

  // Attempt to render nodes — may be a lazy component
  queueMicrotask(() => {
    try {
      const childEl = nodes();

      // If the child is a lazy container, observe when it gets real content
      if (childEl.classList.contains("sibu-lazy")) {
        const observer = new MutationObserver(() => {
          // Check if loading placeholder was replaced with actual content
          const loading = childEl.querySelector(".sibu-lazy-loading");
          if (!loading) {
            observer.disconnect();
            container.replaceChildren(childEl);
          }
        });
        observer.observe(childEl, { childList: true, subtree: true });

        // Also check if already loaded (race condition)
        if (!childEl.querySelector(".sibu-lazy-loading")) {
          container.replaceChildren(childEl);
        }
      } else {
        // Not a lazy component — swap immediately
        container.replaceChildren(childEl);
      }
    } catch {
      // If nodes() throws, keep showing fallback
    }
  });

  return container;
}
