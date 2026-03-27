import { signal } from "./signal";

/**
 * Deep equality comparison for objects and arrays.
 * Falls back to Object.is for primitives.
 * Handles circular references and common built-in types (Date, RegExp).
 */
export function deepEqual(a: unknown, b: unknown, seen?: Set<unknown>): boolean {
  if (Object.is(a, b)) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;

  if (typeof a !== "object") return false;

  // Handle Date
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();

  // Handle RegExp
  if (a instanceof RegExp && b instanceof RegExp) return a.toString() === b.toString();

  // Circular reference detection
  if (!seen) seen = new Set();
  if (seen.has(a)) return true; // Circular: treat as equal to avoid infinite recursion
  seen.add(a);

  if (Array.isArray(a)) {
    if (!Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    return a.every((val, i) => deepEqual(val, b[i], seen));
  }

  const keysA = Object.keys(a as Record<string, unknown>);
  const keysB = Object.keys(b as Record<string, unknown>);
  if (keysA.length !== keysB.length) return false;

  return keysA.every((key) =>
    deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], seen),
  );
}

/**
 * Like signal but uses deep equality comparison instead of Object.is.
 * This prevents unnecessary re-renders when setting an object/array
 * to a structurally identical value.
 *
 * @param initial Initial value
 * @returns Tuple [getter, setter]
 *
 * @example
 * ```ts
 * const [user, setUser] = deepSignal({ name: "Alice", age: 25 });
 * setUser({ name: "Alice", age: 25 }); // No notification — same structure
 * setUser({ name: "Bob", age: 25 });   // Notifies — different value
 * ```
 */
export function deepSignal<T>(initial: T): [() => T, (next: T | ((prev: T) => T)) => void] {
  return signal(initial, { equals: (a, b) => deepEqual(a, b) });
}
