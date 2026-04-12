import type { ReactiveSignal } from "../../reactivity/signal";
import { recordDependency, track, trackingSuspended } from "../../reactivity/track";
import { devAssert } from "../dev";
import type { Accessor } from "./signal";

/**
 * derived creates a derived reactive signal whose value updates when dependencies change.
 *
 * Uses lazy pull-based evaluation with dirty flagging:
 * - When a dependency changes, the computed is marked dirty (no re-evaluation).
 * - Dirtiness propagates downstream via propagateDirty.
 * - The getter only re-evaluates when actually read (pull-based).
 * - On re-evaluation, dependencies are re-tracked via track() so that
 *   derived-of-derived chains propagate correctly.
 */
export function derived<T>(getter: () => T, options?: { name?: string }): Accessor<T> {
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

  // Initial evaluation — sets up dependencies
  track(() => {
    cs._d = false;
    cs._v = getter();
  }, markDirty);

  // DevTools: emit computed:create
  const hook = (globalThis as any).__SIBU_DEVTOOLS_GLOBAL_HOOK__;

  let evaluating = false;

  function computedGetter(): T {
    if (evaluating) {
      throw new Error(
        `[SibuJS] Circular dependency detected in derived${debugName ? ` "${debugName}"` : ""}. ` +
          "A derived signal cannot read itself (directly or through a chain).",
      );
    }

    if (trackingSuspended) {
      if (cs._d) {
        evaluating = true;
        try {
          cs._d = false;
          cs._v = getter();
        } finally {
          evaluating = false;
        }
      }
      return cs._v;
    }

    // Record that the caller depends on this derived
    recordDependency(cs as ReactiveSignal);

    if (cs._d) {
      const oldValue = cs._v;

      evaluating = true;
      try {
        track(() => {
          cs._d = false;
          cs._v = getter();
        }, markDirty);
      } finally {
        evaluating = false;
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

  return computedGetter as Accessor<T>;
}
