import { button, div, h3, p, span, style } from "../core/rendering/html";
import { signal } from "../core/signals/signal";

export interface ErrorBoundaryProps {
  /**
   * Function that renders child content or throws.
   */
  nodes: () => Element;
  /**
   * Fallback renderer given an Error and retry callback.
   * Memoized internally — only re-created when the error changes.
   */
  fallback?: (error: Error, retry: () => void) => Element;
  /**
   * Called when an error is caught (sync or async).
   */
  onError?: (error: Error) => void;
}

// CSS styles for ErrorBoundary
const errorBoundaryStyles = `
  .sibu-error-boundary {
    position: relative;
  }

  .sibu-error-fallback {
    border: 2px solid #dc3545;
    border-radius: 8px;
    padding: 20px;
    margin: 10px 0;
    background: linear-gradient(135deg, #fff5f5 0%, #ffebee 100%);
    box-shadow: 0 2px 12px rgba(220, 53, 69, 0.15);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .sibu-error-fallback .sibu-error-title {
    margin: 0 0 12px 0;
    color: #dc3545;
    font-size: 1.1em;
    font-weight: 600;
  }

  .sibu-error-fallback .sibu-error-message {
    font-family: 'SF Mono', 'Fira Code', 'Roboto Mono', monospace;
    background-color: rgba(0, 0, 0, 0.04);
    padding: 10px 14px;
    border-radius: 6px;
    border: 1px solid rgba(0, 0, 0, 0.08);
    margin: 10px 0;
    color: #495057;
    word-break: break-word;
    font-size: 0.9em;
    line-height: 1.5;
  }

  .sibu-error-fallback .sibu-error-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 18px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s ease;
    margin-top: 8px;
    background-color: #dc3545;
    color: white;
  }

  .sibu-error-fallback .sibu-error-btn:hover {
    background-color: #c82333;
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(220, 53, 69, 0.3);
  }

  .sibu-error-fallback .sibu-error-btn:active {
    transform: translateY(0);
  }
`;

// Inject styles only once
let stylesInjected = false;
function injectStyles() {
  if (!stylesInjected && typeof document !== "undefined") {
    const styleElement = style({ nodes: errorBoundaryStyles });
    document.head.appendChild(styleElement);
    stylesInjected = true;
  }
}

// Memoization cache for fallback elements keyed by error message
const fallbackCache = new WeakMap<(...args: never[]) => unknown, Map<string, Element>>();

function getMemoizedFallback(
  fallbackFn: (error: Error, retry: () => void) => Element,
  error: Error,
  retry: () => void,
): Element {
  let cache = fallbackCache.get(fallbackFn);
  if (!cache) {
    cache = new Map();
    fallbackCache.set(fallbackFn, cache);
  }
  const key = error.message;
  if (!cache.has(key)) {
    cache.set(key, fallbackFn(error, retry));
  }
  return cache.get(key) as Element;
}

/**
 * ErrorBoundary component using SibuJS reactive pattern.
 *
 * Features:
 * - Catches sync errors thrown by nodes
 * - Catches async errors (Promise rejections) from nodes
 * - Supports nested ErrorBoundaries (inner catches first, outer catches propagation)
 * - Retry functionality to clear error and re-render nodes
 * - Memoized fallback to avoid re-creating fallback UI on every render
 * - onError callback for logging/telemetry
 * - Improved CSS styling
 */
export function ErrorBoundary({ nodes, fallback, onError }: ErrorBoundaryProps): Element {
  injectStyles();

  const [error, setError] = signal<Error | null>(null);

  const retry = () => {
    // Clear memoized fallback cache on retry so fresh fallback is created
    if (fallback) {
      fallbackCache.delete(fallback);
    }
    setError(null);
  };

  const handleError = (e: unknown): Error => {
    const errorObj = e instanceof Error ? e : new Error(String(e));
    setError(errorObj);
    onError?.(errorObj);
    return errorObj;
  };

  // Default fallback with improved styling
  const defaultFallback = (err: Error, retryFn: () => void) =>
    div({
      class: "sibu-error-fallback",
      nodes: [
        h3({
          nodes: "Something went wrong",
          class: "sibu-error-title",
        }) as Element,
        p({
          nodes: err.message,
          class: "sibu-error-message",
        }) as Element,
        button({
          nodes: "Retry",
          class: "sibu-error-btn",
          on: { click: retryFn },
        }) as Element,
      ],
    }) as Element;

  const tryRenderFallback = (err: Error): Element => {
    const fn = fallback || defaultFallback;
    try {
      return getMemoizedFallback(fn, err, retry);
    } catch (fallbackError) {
      // Fallback itself failed — propagate to parent ErrorBoundary via DOM event
      // Defer dispatch so the container is connected to the DOM tree first
      const propagateError = fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError));
      queueMicrotask(() => {
        if (container.parentNode) {
          container.dispatchEvent(
            new CustomEvent("sibu:error-propagate", {
              bubbles: true,
              detail: { error: propagateError },
            }),
          );
        }
      });
      return document.createComment("error-boundary-failed") as unknown as Element;
    }
  };

  const container = div({
    class: "sibu-error-boundary",
    nodes: () => {
      const currentError = error();

      if (currentError) {
        return tryRenderFallback(currentError);
      }

      try {
        const result = nodes();

        // Handle async nodes (Promise-returning components)
        if (result && typeof (result as unknown as Promise<Element>).then === "function") {
          const asyncContainer = div({ class: "sibu-error-async" }) as Element;
          asyncContainer.appendChild(span({ class: "sibu-lazy-loading", nodes: "Loading..." }));

          (result as unknown as Promise<Element>)
            .then((el: Element) => {
              asyncContainer.replaceChildren(el);
            })
            .catch((e: unknown) => {
              const err = handleError(e);
              asyncContainer.replaceChildren(tryRenderFallback(err));
            });

          return asyncContainer;
        }

        return result;
      } catch (e) {
        const errorObj = handleError(e);
        return tryRenderFallback(errorObj);
      }
    },
  }) as Element;

  // Listen for error propagation from nested ErrorBoundaries
  container.addEventListener("sibu:error-propagate", (e: Event) => {
    // If this boundary is already in error state, let the event bubble to parent
    if (error()) return;
    e.stopPropagation();
    const customEvent = e as CustomEvent;
    const propagatedError = customEvent.detail?.error;
    if (propagatedError) {
      handleError(propagatedError);
    }
  });

  return container;
}
