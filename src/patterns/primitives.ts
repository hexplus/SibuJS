import { derived } from "../core/signals/derived";
import { effect } from "../core/signals/effect";
import { signal } from "../core/signals/signal";

/**
 * SolidJS-style reactive primitives — standalone APIs that don't require
 * being inside a component. These are thin wrappers around the signal system.
 */

/**
 * Creates a reactive signal. Equivalent to signal but with SolidJS naming.
 *
 * @param value Initial value
 * @returns Tuple [getter, setter]
 *
 * @example
 * ```ts
 * const [count, setCount] = createSignal(0);
 * console.log(count()); // 0
 * setCount(5);
 * ```
 */
export function createSignal<T>(value: T): [() => T, (next: T | ((prev: T) => T)) => void] {
  return signal(value);
}

/**
 * Creates a derived/computed reactive value. Equivalent to derived.
 *
 * @param fn Computation function that reads other signals
 * @returns Getter for the computed value
 *
 * @example
 * ```ts
 * const [count] = createSignal(5);
 * const doubled = createMemo(() => count() * 2);
 * console.log(doubled()); // 10
 * ```
 */
export function createMemo<T>(fn: () => T): () => T {
  return derived(fn);
}

/**
 * Creates a reactive side effect. Equivalent to effect.
 *
 * @param fn Effect function that reads reactive signals
 * @returns Cleanup/teardown function
 *
 * @example
 * ```ts
 * const [count] = createSignal(0);
 * const cleanup = createEffect(() => {
 *   console.log("Count is:", count());
 * });
 * ```
 */
export function createEffect(fn: () => void): () => void {
  return effect(fn);
}
