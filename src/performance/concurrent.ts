// ============================================================================
// CONCURRENT RENDERING UTILITIES
// ============================================================================

import { effect } from "../core/signals/effect";
import { signal } from "../core/signals/signal";
import { Priority, scheduleUpdate } from "./scheduler";

/**
 * Mark a state update as non-urgent.
 * The callback is scheduled at NORMAL priority so it won't block
 * high-priority work like user input handling.
 */
export function startTransition(callback: () => void): void {
  scheduleUpdate(Priority.NORMAL, callback);
}

/**
 * Returns a deferred getter for a reactive value.
 * The deferred value mirrors the source but updates at LOW priority,
 * allowing the UI to remain responsive while expensive derived state
 * catches up.
 *
 * Uses an effect to subscribe to the source getter. When the source
 * changes, a LOW-priority update is scheduled. The deferred signal
 * only updates when the scheduler flushes, so fast bursts of source
 * changes collapse into a single deferred update.
 */
export function deferredValue<T>(getter: () => T): () => T {
  const [deferred, setDeferred] = signal<T>(getter());
  let latest: T = deferred();

  effect(() => {
    latest = getter();
    scheduleUpdate(Priority.LOW, () => setDeferred(latest));
  });

  return deferred;
}

/**
 * Provides a `startTransition` wrapper paired with a reactive
 * `isPending` flag that is `true` while the transition is in flight.
 *
 * Usage:
 *   const [isPending, startTransition] = transitionState();
 *   startTransition(() => { setSomeState(newValue); });
 *   if (isPending()) { // show spinner }
 */
export function transitionState(): [isPending: () => boolean, startTransition: (cb: () => void) => void] {
  const [isPending, setIsPending] = signal(false);

  function transition(callback: () => void): void {
    setIsPending(true);

    scheduleUpdate(Priority.NORMAL, () => {
      callback();

      // Mark the transition as complete after the callback's work
      // has been flushed at NORMAL priority.
      scheduleUpdate(Priority.NORMAL, () => {
        setIsPending(false);
      });
    });
  }

  return [isPending, transition];
}

// ============================================================================
// UNIQUE ID GENERATION
// ============================================================================

let idCounter = 0;
let idPrefix = "sibu";

/**
 * Reset the ID counter. Call at the start of each SSR request
 * to ensure server and client produce matching IDs.
 */
export function resetIdCounter(): void {
  idCounter = 0;
}

/**
 * Set a custom prefix for generated IDs.
 * Useful when multiple SibuJS apps coexist on the same page.
 */
export function setIdPrefix(prefix: string): void {
  idPrefix = prefix;
}

/**
 * Generate a unique, stable ID for use in accessibility attributes.
 * SSR-compatible: call resetIdCounter() at the start of each SSR render
 * to ensure server and client produce matching IDs.
 *
 * @param suffix Optional suffix appended to the generated ID
 * @returns A unique ID string like "sibu-0", "sibu-1-label"
 *
 * @example
 * ```ts
 * const id = id();
 * label({ htmlFor: id }, "Name");
 * input({ id, type: "text" });
 * ```
 */
export function uniqueId(suffix?: string): string {
  const id = `${idPrefix}-${idCounter++}`;
  return suffix ? `${id}-${suffix}` : id;
}
