/**
 * Lifecycle hooks for SibuJS components.
 *
 * These hooks schedule callbacks to run after the component's DOM
 * has been mounted or when it is removed from the document.
 *
 * @example
 * ```ts
 * function MyComponent() {
 *   onMount(() => {
 *     console.log("Component is in the DOM");
 *   });
 *
 *   onUnmount(() => {
 *     console.log("Component was removed");
 *   });
 *
 *   return div("Hello");
 * }
 * ```
 */

import { devWarn } from "../dev";
import { registerDisposer } from "./dispose";

type CleanupFn = () => void;

/** Safely invoke a lifecycle callback, catching and logging errors in dev mode.
 *  Returns the callback's return value (used to capture onMount cleanup functions). */
function safeCall(cb: () => unknown, hookName: string): unknown {
  try {
    return cb();
  } catch (err) {
    devWarn(`${hookName}: callback threw: ${err instanceof Error ? err.message : String(err)}`);
    return undefined;
  }
}

/** Run onMount callback and register returned cleanup function (if any) on the element. */
function runMountCallback(callback: () => undefined | CleanupFn, hookName: string, element?: HTMLElement): void {
  const cleanup = safeCall(callback, hookName);
  if (typeof cleanup === "function" && element) {
    registerDisposer(element, cleanup as CleanupFn);
  }
}

/**
 * Runs a callback once the component's element has been inserted into the DOM.
 * Uses queueMicrotask to defer execution until after the current synchronous
 * rendering pass completes.
 *
 * Optionally returns a cleanup function that will be called on unmount
 * (if you also use onUnmount, prefer that for explicit cleanup).
 *
 * @param callback Function to run after mount. May return a cleanup function.
 * @param element Optional element to observe; if provided, waits until it's connected.
 */
export function onMount(callback: () => undefined | CleanupFn, element?: HTMLElement): void {
  // No-op during SSR — lifecycle hooks are client-only
  if (typeof document === "undefined") return;

  if (element) {
    // If element is already connected, run immediately (deferred)
    if (element.isConnected) {
      queueMicrotask(() => runMountCallback(callback, "onMount", element));
      return;
    }

    // Otherwise, use MutationObserver to detect when element enters the DOM
    const observer = new MutationObserver(() => {
      if (element.isConnected) {
        observer.disconnect();
        runMountCallback(callback, "onMount", element);
      }
    });

    // Observe the document body for childList changes (subtree).
    // Register a disposer so the observer is disconnected if the element
    // is disposed before it ever gets connected (prevents leaked observer).
    registerDisposer(element, () => observer.disconnect());

    queueMicrotask(() => {
      if (element.isConnected) {
        runMountCallback(callback, "onMount", element);
      } else {
        observer.observe(document.body, { childList: true, subtree: true });
      }
    });
  } else {
    // No element specified — just defer to next microtask (after render)
    queueMicrotask(() => {
      safeCall(callback, "onMount");
    });
  }
}

/**
 * Runs a callback when the given element is removed from the DOM.
 * Uses MutationObserver to watch for disconnection.
 *
 * @param callback Function to run on unmount
 * @param element The element to watch for removal
 */
export function onUnmount(callback: CleanupFn, element: HTMLElement): void {
  // Primary path: use registerDisposer so dispose()/when()/match()/each()
  // all trigger the callback without needing a MutationObserver.
  registerDisposer(element, () => safeCall(callback, "onUnmount"));

  // Fallback: MutationObserver for cases where the element is removed from
  // the DOM without going through dispose() (e.g., manual .remove() calls).
  const startObserving = () => {
    const observer = new MutationObserver(() => {
      if (!element.isConnected) {
        observer.disconnect();
        safeCall(callback, "onUnmount");
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    // Clean up the observer when the element is disposed
    registerDisposer(element, () => observer.disconnect());
  };

  if (element.isConnected) {
    startObserving();
  } else {
    onMount(() => {
      startObserving();
      return undefined;
    }, element);
  }
}

/**
 * Register a cleanup callback that runs when the given element is disposed.
 * Integrates with `when()`, `match()`, and `each()` which call `dispose()`
 * on removed nodes, triggering all registered cleanup functions.
 *
 * @param callback Cleanup function (close sockets, clear intervals, etc.)
 * @param element The component's root node to attach cleanup to
 *
 * @example
 * ```ts
 * function RealtimeBar(siteId: string) {
 *   const ws = new WebSocket(`/ws/sites/${siteId}/realtime`);
 *   const root = div("Realtime data...");
 *   onCleanup(() => ws.close(), root);
 *   return root;
 * }
 * ```
 */
export function onCleanup(callback: CleanupFn, element: Node): void {
  registerDisposer(element, callback);
}
