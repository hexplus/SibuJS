import { devWarn, isDev } from "../core/dev";
import type { ReactiveSignal } from "./signal";

type Subscriber = () => void;

// Cache dev mode at module load for zero-cost production checks
const _isDev = isDev();

// Stack to support nested subscribers — pre-allocated with index for O(1) push/pop
const subscriberStack: (Subscriber | null)[] = new Array(32);
let stackCapacity = 32;
let stackTop = -1;
let currentSubscriber: Subscriber | null = null;

// Subscriber deps stored directly on subscriber as _deps property (avoids WeakMap).
// Signal subscribers stored in Set cached on signal as __s (avoids WeakMap in hot path).
const signalSubscribers = new WeakMap<ReactiveSignal, Set<Subscriber>>();

// Fast notification cache: store the Set reference directly on the signal
// for O(1) property access during notification (avoids WeakMap hash lookup).
// The cached Set is the SAME object stored in signalSubscribers.
const SUBS = "__s" as const;
type SignalWithCache = ReactiveSignal & { [SUBS]?: Set<Subscriber> };

// Notification queue for cascading propagation with deduplication.
let notifyDepth = 0;
const pendingQueue: Subscriber[] = [];
const pendingSet = new Set<Subscriber>();

/**
 * Safely invoke a subscriber, catching errors to prevent one failing
 * subscriber from killing remaining subscribers in the notification queue.
 */
function safeInvoke(sub: Subscriber): void {
  try {
    sub();
  } catch (err) {
    if (_isDev) devWarn(`Subscriber threw during notification: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// Suspend/resume tracking: counter-based for nested computed evaluations.
let suspendDepth = 0;
export let trackingSuspended = false;

/**
 * Track dependencies of an effect or computed subscriber.
 * Returns a teardown function to remove all subscriptions.
 */
export function track(effectFn: () => void, subscriber?: Subscriber): () => void {
  if (!subscriber) subscriber = effectFn;
  cleanup(subscriber);

  ++stackTop;
  if (stackTop >= stackCapacity) {
    stackCapacity *= 2;
    subscriberStack.length = stackCapacity;
  }
  subscriberStack[stackTop] = subscriber;
  currentSubscriber = subscriber;

  try {
    effectFn();
  } finally {
    stackTop--;
    currentSubscriber = stackTop >= 0 ? subscriberStack[stackTop] : null;
  }

  return () => cleanup(subscriber);
}

/**
 * Suspend dependency tracking. Used by lazy computed re-evaluation.
 */
export function suspendTracking(): void {
  if (suspendDepth === 0) {
    ++stackTop;
    if (stackTop >= stackCapacity) {
      stackCapacity *= 2;
      subscriberStack.length = stackCapacity;
    }
    subscriberStack[stackTop] = null;
    currentSubscriber = null;
    trackingSuspended = true;
  }
  suspendDepth++;
}

/**
 * Resume dependency tracking after suspendTracking().
 */
export function resumeTracking(): void {
  suspendDepth--;
  if (suspendDepth === 0) {
    stackTop--;
    currentSubscriber = stackTop >= 0 ? subscriberStack[stackTop] : null;
    trackingSuspended = false;
  }
}

/**
 * Execute a function without tracking any signal reads as dependencies.
 * Useful for reading signals inside effects without creating subscriptions.
 *
 * @param fn Function to execute without dependency tracking
 * @returns The return value of fn
 */
export function untracked<T>(fn: () => T): T {
  suspendTracking();
  try {
    return fn();
  } finally {
    resumeTracking();
  }
}

/**
 * Record that the current subscriber depends on this signal.
 *
 * Fast path: for the first dependency of a subscriber, stores the signal
 * directly as _dep (avoiding Set allocation). Promotes to _deps Set only
 * when a second dependency is recorded. Most effects/computeds have 1-3 deps,
 * so the single-dep fast path eliminates Set overhead in the common case.
 */
export function recordDependency(signal: ReactiveSignal) {
  if (!currentSubscriber) return;

  const sub = currentSubscriber as any;

  // Fast path: check single-dep slot first
  if (sub._dep === signal) return;

  const deps: Set<ReactiveSignal> | undefined = sub._deps;
  if (deps) {
    if (deps.has(signal)) return;
    deps.add(signal);
  } else if (sub._dep !== undefined) {
    // Promote single-dep to Set
    const set = new Set<ReactiveSignal>();
    set.add(sub._dep);
    set.add(signal);
    sub._deps = set;
    sub._dep = undefined;
  } else {
    // First dep — store directly, no Set allocation
    sub._dep = signal;
  }

  // Register subscriber on the signal
  let subs = (signal as SignalWithCache)[SUBS];
  if (!subs) {
    subs = new Set();
    signalSubscribers.set(signal, subs);
    (signal as SignalWithCache)[SUBS] = subs;
  }
  subs.add(currentSubscriber);
  if (subs.size === 1) {
    (signal as any).__f = currentSubscriber;
  } else if ((signal as any).__f !== undefined) {
    (signal as any).__f = undefined;
  }
}

/**
 * Queue all subscribers of a signal for deferred notification.
 * Computed subscribers (_c) are propagated through the chain via propagateDirty
 * so their downstream effect subscribers get queued correctly.
 */
export function queueSignalNotification(signal: ReactiveSignal): void {
  const subs = (signal as SignalWithCache)[SUBS];
  if (!subs) return;
  for (const sub of subs) {
    if ((sub as any)._c) {
      propagateDirty(sub);
    } else if (!pendingSet.has(sub)) {
      pendingSet.add(sub);
      pendingQueue.push(sub);
    }
  }
}

/**
 * Process all pending subscriber notifications.
 */
export function drainNotificationQueue(): void {
  if (notifyDepth > 0) return;
  notifyDepth++;
  try {
    let i = 0;
    while (i < pendingQueue.length) {
      safeInvoke(pendingQueue[i]);
      i++;
    }
  } finally {
    pendingQueue.length = 0;
    pendingSet.clear();
    notifyDepth--;
  }
}

/**
 * Iteratively propagate dirty flags through a computed chain.
 * markDirty (tagged _c) sets the dirty flag. _sig exposes the computed's
 * signal for walking downstream subscribers without recursive calls.
 *
 * In the __f fast path (single-subscriber chains), sets _d directly on
 * the signal and evaluates _g inline — avoids megamorphic function calls
 * to markDirty and _re. Combined with suspendTracking, this eliminates
 * the pull-phase recursive call stack entirely.
 *
 * Eager evaluation is only applied to single-dep computeds (_deps.size === 1).
 * Multi-dep computeds (e.g. aggregators in wide diamonds) are marked dirty
 * and pulled lazily — avoids O(n²) re-evaluation when many deps update.
 */
/**
 * Iteratively propagate dirty flags through a computed chain.
 *
 * Marks each computed dirty and walks downstream subscribers.
 * Does NOT eagerly evaluate — computedGetter uses track() on re-evaluation
 * to re-register dependencies, which is essential for derived-of-derived chains
 * (e.g. formula cells referencing other formula cells).
 */
function propagateDirty(sub: () => void): void {
  sub(); // markDirty: sets dirty flag
  let sig: ReactiveSignal | undefined = (sub as any)._sig;

  while (sig) {
    // Fast path: single subscriber cached in __f (common in computed chains)
    const first: any = (sig as any).__f;
    if (first) {
      if (first._c) {
        const nSig: any = first._sig;
        // Mark dirty (no eager evaluation — let lazy pull + track() handle it)
        nSig._d = true;
        sig = nSig;
        continue;
      }
      // Single effect subscriber — queue it
      if (!pendingSet.has(first)) {
        pendingSet.add(first);
        pendingQueue.push(first);
      }
      break;
    }

    // Multi-subscriber path (Set iteration)
    const subs = (sig as SignalWithCache)[SUBS];
    if (!subs) break;

    let nextSig: ReactiveSignal | undefined;
    for (const s of subs) {
      if ((s as any)._c) {
        s(); // markDirty
        const nSig = (s as any)._sig;
        if (nSig && !nextSig) {
          nextSig = nSig;
        } else if (nSig) {
          propagateDirty(s);
        }
      } else if (!pendingSet.has(s)) {
        pendingSet.add(s);
        pendingQueue.push(s);
      }
    }
    sig = nextSig;
  }
}

/**
 * Notify all subscribers of a given signal change.
 *
 * Two-pass outermost notification:
 *   Pass 1: Computed subscribers run first for dirty propagation (iterative).
 *           Effect subscribers discovered via cascading are queued with dedup.
 *   Pass 2: Direct effect subscribers run, skipping those already queued
 *           by cascading (fixes diamond double-execution).
 *   Pass 3: Drain any remaining cascading effects.
 *
 * This avoids adding ALL subscribers to pendingSet upfront (which would add
 * overhead to the common flat fan-out case with 10K+ effects).
 */
export function notifySubscribers(signal: ReactiveSignal) {
  // Fast path: single subscriber (avoids Set iteration entirely)
  const first: any = (signal as any).__f;
  if (first) {
    if (notifyDepth > 0) {
      if (first._c) {
        propagateDirty(first);
      } else if (!pendingSet.has(first)) {
        pendingSet.add(first);
        pendingQueue.push(first);
      }
      return;
    }
    notifyDepth++;
    try {
      if (first._c) {
        propagateDirty(first);
      } else {
        safeInvoke(first);
      }
      // Drain cascading effects
      let i = 0;
      while (i < pendingQueue.length) {
        safeInvoke(pendingQueue[i]);
        i++;
      }
    } finally {
      pendingQueue.length = 0;
      pendingSet.clear();
      notifyDepth--;
    }
    return;
  }

  const subs = (signal as SignalWithCache)[SUBS];
  if (!subs || subs.size === 0) return;

  if (notifyDepth > 0) {
    // Cascading: computed subs propagated iteratively, effects queued with dedup
    for (const sub of subs) {
      if ((sub as any)._c) {
        propagateDirty(sub);
      } else if (!pendingSet.has(sub)) {
        pendingSet.add(sub);
        pendingQueue.push(sub);
      }
    }
    return;
  }

  // Outermost notification
  notifyDepth++;
  try {
    // Snapshot direct subscribers
    let directCount = 0;
    for (const sub of subs) {
      pendingQueue[directCount++] = sub;
    }

    // Pass 1: Run computed subscribers for dirty propagation (iterative)
    for (let i = 0; i < directCount; i++) {
      if ((pendingQueue[i] as any)._c) {
        propagateDirty(pendingQueue[i]);
      }
    }

    // Pass 2: Run direct effect subscribers, skip those already queued
    // by cascading during Pass 1 (prevents diamond double-execution)
    for (let i = 0; i < directCount; i++) {
      if (!(pendingQueue[i] as any)._c) {
        if (!pendingSet.has(pendingQueue[i])) {
          safeInvoke(pendingQueue[i]);
        }
      }
    }

    // Pass 3: Drain cascading effects queued during propagation
    let i = directCount;
    while (i < pendingQueue.length) {
      safeInvoke(pendingQueue[i]);
      i++;
    }
  } finally {
    pendingQueue.length = 0;
    pendingSet.clear();
    notifyDepth--;
  }
}

/**
 * Remove a subscriber from all signal dependency lists.
 */
function cleanup(subscriber: Subscriber) {
  const sub = subscriber as any;

  // Fast path: single dependency (no Set to iterate)
  const singleDep: ReactiveSignal | undefined = sub._dep;
  if (singleDep !== undefined) {
    const subs = (singleDep as SignalWithCache)[SUBS];
    if (subs) {
      subs.delete(subscriber);
      if ((singleDep as any).__f === subscriber) {
        (singleDep as any).__f = undefined;
      }
    }
    sub._dep = undefined;
    return;
  }

  // Multi-dep path
  const deps: Set<ReactiveSignal> | undefined = sub._deps;
  if (!deps || deps.size === 0) return;

  for (const signal of deps) {
    const subs = (signal as SignalWithCache)[SUBS];
    if (subs) {
      subs.delete(subscriber);
      if ((signal as any).__f === subscriber) {
        (signal as any).__f = undefined;
      }
    }
  }

  deps.clear();
}
