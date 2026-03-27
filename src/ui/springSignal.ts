import { signal } from "../core/signals/signal";

/**
 * Options for springSignal.
 */
export interface SpringOptions {
  /** Spring stiffness (0–1). Higher = snappier. Default: 0.15 */
  stiffness?: number;
  /** Damping ratio (0–1). Higher = less bouncy. Default: 0.8 */
  damping?: number;
  /** Precision threshold to stop the animation. Default: 0.01 */
  precision?: number;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Creates a reactive spring-animated value. The getter returns the
 * current animated number (updated every frame via rAF). The setter
 * sets the target — the spring smoothly animates toward it using
 * physics simulation (stiffness + damping).
 *
 * Returns a `[getter, setter, dispose]` tuple.
 *
 * Respects `prefers-reduced-motion`: when enabled, snaps instantly
 * to the target with no animation.
 *
 * @param initial Starting value
 * @param options Spring physics parameters
 * @returns `[get, set, dispose]` — dispose cancels the animation loop
 *
 * @example
 * ```ts
 * const [x, setX, disposeSpring] = springSignal(0, { stiffness: 0.12, damping: 0.7 });
 *
 * // Animate to 200
 * setX(200);
 *
 * // Use in reactive binding
 * div({ style: { transform: () => `translateX(${x()}px)` } });
 *
 * // Cleanup when done
 * disposeSpring();
 * ```
 */
export function springSignal(
  initial: number,
  options?: SpringOptions,
): [get: () => number, set: (target: number) => void, dispose: () => void] {
  const stiffness = options?.stiffness ?? 0.15;
  const damping = options?.damping ?? 0.8;
  const precision = options?.precision ?? 0.01;

  const [value, setValue] = signal(initial);

  let current = initial;
  let velocity = 0;
  let target = initial;
  let rafId: number | null = null;

  function tick(): void {
    const force = -stiffness * (current - target);
    const dampingForce = -damping * velocity;
    velocity += force + dampingForce;
    current += velocity;

    // Check if settled
    if (Math.abs(current - target) < precision && Math.abs(velocity) < precision) {
      current = target;
      velocity = 0;
      rafId = null;
      setValue(current);
      return;
    }

    setValue(current);
    rafId = requestAnimationFrame(tick);
  }

  function set(newTarget: number): void {
    target = newTarget;

    // Snap immediately when reduced motion is preferred
    if (prefersReducedMotion()) {
      current = newTarget;
      velocity = 0;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      setValue(current);
      return;
    }

    // Start animation loop if not already running
    if (rafId === null) {
      rafId = requestAnimationFrame(tick);
    }
  }

  function dispose(): void {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  return [value, set, dispose];
}
