import { signal } from "../core/signals/signal";

// ============================================================================
// OPTIMISTIC UPDATES
// ============================================================================

export interface OptimisticAction<T> {
  optimisticValue: T;
  revert: T;
}

/**
 * optimistic provides optimistic UI updates that can be reverted on failure.
 * The value updates immediately, then reverts if the async operation fails.
 *
 * Note: concurrent optimistic updates on the same value are inherently
 * ambiguous. If multiple operations are in flight, a failed revert restores
 * the value captured before that specific operation started.
 */
export function optimistic<T>(
  initialValue: T,
): [() => T, (optimisticValue: T, asyncAction: () => Promise<T>) => Promise<void>] {
  const [value, setValue] = signal<T>(initialValue);
  const [_pending, setPending] = signal(false);

  async function addOptimistic(optimisticValue: T, asyncAction: () => Promise<T>): Promise<void> {
    const previousValue = value();
    setValue(optimisticValue);
    setPending(true);

    try {
      const result = await asyncAction();
      setValue(result);
    } catch {
      // Revert on failure
      setValue(previousValue);
    } finally {
      setPending(false);
    }
  }

  return [value, addOptimistic];
}

/**
 * optimisticList provides optimistic updates for array state.
 *
 * Uses functional updates (setItems(current => ...)) for the success path
 * to avoid losing changes made by concurrent operations. The failure path
 * reverts to a snapshot taken before the operation started.
 */
export function optimisticList<T>(initialValue: T[]): {
  items: () => T[];
  addOptimistic: (item: T, asyncAction: () => Promise<T>) => Promise<void>;
  removeOptimistic: (predicate: (item: T) => boolean, asyncAction: () => Promise<void>) => Promise<void>;
  updateOptimistic: (
    predicate: (item: T) => boolean,
    update: Partial<T>,
    asyncAction: () => Promise<T>,
  ) => Promise<void>;
} {
  const [items, setItems] = signal<T[]>([...initialValue]);

  async function addOptimistic(item: T, asyncAction: () => Promise<T>): Promise<void> {
    const prev = items();
    setItems([...prev, item]);

    try {
      const result = await asyncAction();
      // Use functional update for success to preserve concurrent additions
      setItems((current) => {
        // Find and replace the optimistic item at the position it was added
        const idx = current.lastIndexOf(item);
        if (idx >= 0) {
          const next = [...current];
          next[idx] = result;
          return next;
        }
        return [...current.filter((i) => i !== item), result];
      });
    } catch {
      setItems(prev);
    }
  }

  async function removeOptimistic(predicate: (item: T) => boolean, asyncAction: () => Promise<void>): Promise<void> {
    const prev = items();
    setItems(prev.filter((item) => !predicate(item)));

    try {
      await asyncAction();
    } catch {
      setItems(prev);
    }
  }

  async function updateOptimistic(
    predicate: (item: T) => boolean,
    update: Partial<T>,
    asyncAction: () => Promise<T>,
  ): Promise<void> {
    const prev = items();
    setItems(prev.map((item) => (predicate(item) ? { ...item, ...update } : item)));

    try {
      const result = await asyncAction();
      // Use functional update for success to preserve concurrent changes
      setItems((current) => current.map((item) => (predicate(item) ? result : item)));
    } catch {
      setItems(prev);
    }
  }

  return { items, addOptimistic, removeOptimistic, updateOptimistic };
}
