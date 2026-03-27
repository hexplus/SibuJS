import { track, untracked } from "../../reactivity/track";
import { devAssert } from "../dev";
import { isSSR } from "../ssr-context";

/** Options for effect */
export interface EffectOptions {
  /** Error handler for exceptions thrown during effect execution. */
  onError?: (error: unknown) => void;
}

const _g = globalThis as any;

/**
 * Creates a callback that only tracks the specified dependencies,
 * running the handler in an untracked context. Use with `effect()`
 * to control exactly which signals trigger re-execution.
 *
 * @param deps Getter(s) whose return values are tracked as dependencies
 * @param handler Called with the current dependency value(s) whenever they change
 * @returns A function suitable for passing to `effect()`
 *
 * @example
 * ```ts
 * const [count, setCount] = signal(0);
 * const [label, setLabel] = signal("clicks");
 *
 * // Only re-runs when count changes, NOT when label changes
 * effect(on(() => count(), (c) => {
 *   console.log(`${c} ${label()}`);  // label() read but not tracked
 * }));
 * ```
 */
export function on<T>(deps: () => T, handler: (value: T, prev: T | undefined) => void): () => void {
  let prev: T | undefined;
  let first = true;

  return () => {
    const value = deps();
    if (first) {
      first = false;
      prev = value;
      untracked(() => handler(value, undefined));
    } else {
      const p = prev;
      prev = value;
      untracked(() => handler(value, p));
    }
  };
}

/**
 * effect runs the provided effectFn immediately and re-runs it whenever
 * any reactive dependency changes.
 * Returns a cleanup function to stop further executions.
 *
 * In SSR mode, effect is a no-op — side effects should not run on the server.
 */
export function effect(effectFn: () => void, options?: EffectOptions): () => void {
  devAssert(typeof effectFn === "function", "effect: argument must be a function.");

  // No-op during SSR — side effects are client-only
  if (isSSR()) return () => {};

  const onError = options?.onError;

  // When onError is provided, wrap the effect function in a try/catch.
  // When not provided, use the raw effectFn — zero overhead for the default case.
  const wrappedFn = onError
    ? () => {
        try {
          effectFn();
        } catch (err) {
          onError(err);
        }
      }
    : effectFn;

  let cleanupHandle: () => void = () => {};

  const subscriber = () => {
    cleanupHandle();
    cleanupHandle = track(wrappedFn, subscriber);
  };

  cleanupHandle = track(wrappedFn, subscriber);

  const hook = _g.__SIBU_DEVTOOLS_GLOBAL_HOOK__;
  if (hook) hook.emit("effect:create", { effectFn });

  return () => {
    const h = _g.__SIBU_DEVTOOLS_GLOBAL_HOOK__;
    if (h) h.emit("effect:destroy", { effectFn });
    cleanupHandle();
  };
}
