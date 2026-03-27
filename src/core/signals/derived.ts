import type { ReactiveSignal } from "../../reactivity/signal";
import { recordDependency, resumeTracking, suspendTracking, track, trackingSuspended } from "../../reactivity/track";
import { devAssert } from "../dev";

/**
 * derived creates a derived reactive signal whose value updates when dependencies change.
 *
 * Uses lazy pull-based evaluation with dirty flagging:
 * - When a dependency changes, the computed is marked dirty (no re-evaluation).
 * - Dirtiness propagates downstream via notifySubscribers.
 * - The getter only re-evaluates when actually read (pull-based).
 */
export function derived<T>(getter: () => T, options?: { name?: string }): () => T {
  devAssert(typeof getter === "function", "derived: argument must be a getter function.");
  const debugName = options?.name;
  const cs: any = {};
  cs._d = false;
  cs._g = getter;

  const markDirty = (): void => {
    if (cs._d) return;
    cs._d = true;
  };
  (markDirty as any)._c = 1;
  (markDirty as any)._sig = cs;

  track(() => {
    cs._d = false;
    cs._v = getter();
  }, markDirty);

  // DevTools: emit computed:create
  const hook = (globalThis as any).__SIBU_DEVTOOLS_GLOBAL_HOOK__;

  function computedGetter(): T {
    if (trackingSuspended) {
      if (cs._d) {
        cs._d = false;
        cs._v = getter();
      }
      return cs._v;
    }

    recordDependency(cs as ReactiveSignal);
    if (cs._d) {
      const oldValue = cs._v;
      cs._d = false;
      suspendTracking();
      try {
        cs._v = getter();
      } finally {
        resumeTracking();
      }
      // DevTools: emit computed recomputation
      if (hook && oldValue !== cs._v) {
        hook.emit("computed:update", { signal: cs, oldValue, newValue: cs._v });
      }
    }
    return cs._v;
  }

  // Tag getter for devtools introspection
  if (debugName) {
    (computedGetter as unknown as Record<string, unknown>).__name = debugName;
    cs.__name = debugName;
  }
  (computedGetter as unknown as Record<string, unknown>).__signal = cs;

  if (hook) hook.emit("computed:create", { signal: cs, name: debugName, getter: computedGetter });

  return computedGetter;
}
