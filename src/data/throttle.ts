import { effect } from "../core/signals/effect";
import { signal } from "../core/signals/signal";

/**
 * Returns a throttled reactive getter that updates at most once per `interval` ms.
 * Leading edge: first change propagates immediately.
 * Trailing edge: last change during cooldown propagates when cooldown ends.
 *
 * @param getter A reactive getter to throttle
 * @param interval Throttle interval in milliseconds
 * @returns A reactive getter for the throttled value
 *
 * @example
 * ```ts
 * const [scrollY, setScrollY] = signal(0);
 * const throttled = throttle(scrollY, 100);
 * // throttled() updates at most once every 100ms
 * ```
 */
export function throttle<T>(getter: () => T, interval: number): () => T {
  const [throttled, setThrottled] = signal<T>(getter());
  let cooldown = false;
  let pending: { value: T } | null = null;
  let lastEmitted: T = getter();

  effect(() => {
    const value = getter();

    if (!cooldown) {
      // Leading edge: only fire and enter cooldown if value actually changed
      if (!Object.is(value, lastEmitted)) {
        setThrottled(value);
        lastEmitted = value;
        cooldown = true;
        pending = null;
        setTimeout(() => {
          cooldown = false;
          if (pending !== null) {
            const trailingValue = pending.value;
            pending = null;
            setThrottled(trailingValue);
            lastEmitted = trailingValue;
          }
        }, interval);
      }
    } else {
      // Inside cooldown: save latest value for trailing edge
      pending = { value };
    }
  });

  return throttled;
}
