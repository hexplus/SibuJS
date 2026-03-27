import { track } from "../../reactivity/track";
import { devAssert } from "../dev";
import { isSSR } from "../ssr-context";

const _g = globalThis as any;

/**
 * effect runs the provided effectFn immediately and re-runs it whenever
 * any reactive dependency changes.
 * Returns a cleanup function to stop further executions.
 *
 * In SSR mode, effect is a no-op — side effects should not run on the server.
 */
export function effect(effectFn: () => void): () => void {
  devAssert(typeof effectFn === "function", "effect: argument must be a function.");

  // No-op during SSR — side effects are client-only
  if (isSSR()) return () => {};

  let cleanupHandle: () => void = () => {};

  const subscriber = () => {
    cleanupHandle();
    cleanupHandle = track(effectFn, subscriber);
  };

  cleanupHandle = track(effectFn, subscriber);

  const hook = _g.__SIBU_DEVTOOLS_GLOBAL_HOOK__;
  if (hook) hook.emit("effect:create", { effectFn });

  return () => {
    const h = _g.__SIBU_DEVTOOLS_GLOBAL_HOOK__;
    if (h) h.emit("effect:destroy", { effectFn });
    cleanupHandle();
  };
}
