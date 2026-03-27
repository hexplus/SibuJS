/**
 * Hot Module Replacement utilities for SibuJS.
 * Preserves component state during development reloads.
 *
 * During development the HMR runtime keeps a global store of component state
 * keyed by a developer-supplied ID.  When a module is hot-reloaded the new
 * component implementation can re-use the preserved state so that the user
 * does not lose context (form values, scroll position, etc.).
 *
 * The utilities integrate with bundlers that expose a `module.hot` or
 * `import.meta.hot` API (Webpack, Vite, Parcel, etc.).
 */

import { signal } from "../core/signals/signal";

// ---------------------------------------------------------------------------
// Internal HMR state store
// ---------------------------------------------------------------------------

/** Global state store that survives across module reloads */
const hmrStateStore = new Map<string, unknown>();

/** Registry of active HMR component registrations */
const hmrRegistry = new Map<
  string,
  {
    component: () => HTMLElement;
    container?: HTMLElement;
    currentElement?: HTMLElement;
    disposeCallbacks: Array<() => void>;
  }
>();

// ---------------------------------------------------------------------------
// hmrState
// ---------------------------------------------------------------------------

/**
 * Create an HMR-aware state that persists across module reloads.
 * During development, state is stored in a global map keyed by a unique `id`.
 * On the first load the `initial` value is used; on subsequent hot reloads
 * the previously stored value is restored.
 *
 * @param id       Unique identifier for this state (should be stable across reloads)
 * @param initial  Initial value used on the very first load
 * @returns A `[getter, setter]` tuple compatible with `signal`
 *
 * @example
 * ```ts
 * const [count, setCount] = hmrState("MyCounter.count", 0);
 * // After a hot reload, `count()` will still return the last known value.
 * ```
 */
export function hmrState<T>(id: string, initial: T): [() => T, (value: T | ((prev: T) => T)) => void] {
  // Restore from the HMR store if a previous value exists
  const restored = hmrStateStore.has(id) ? (hmrStateStore.get(id) as T) : initial;

  const [get, set] = signal<T>(restored);

  function hmrSet(next: T | ((prev: T) => T)): void {
    set(next);
    // Persist the latest value so it survives the next hot reload
    hmrStateStore.set(id, get());
  }

  // Also persist the initial / restored value immediately
  hmrStateStore.set(id, restored);

  return [get, hmrSet];
}

// ---------------------------------------------------------------------------
// registerHMR
// ---------------------------------------------------------------------------

/**
 * Register a component for HMR updates.
 * When the module is hot-reloaded the component is re-rendered with preserved
 * state by swapping out the old DOM element for the new one produced by the
 * updated component function.
 *
 * @param id          Stable identifier for the component
 * @param component   Factory function that returns the component's root element
 * @param container   Optional container element – if provided the initial element
 *                    is automatically appended to it
 * @returns An object with `update` (swap implementation) and `dispose` (clean up)
 *
 * @example
 * ```ts
 * const hmr = registerHMR("MyWidget", () => MyWidget());
 *
 * // On hot update:
 * hmr.update(() => MyWidgetV2());
 *
 * // On full teardown:
 * hmr.dispose();
 * ```
 */
export function registerHMR(
  id: string,
  component: () => HTMLElement,
  container?: HTMLElement,
): {
  /** Update the component implementation (called on hot reload) */
  update: (newComponent: () => HTMLElement) => void;
  /** Dispose the HMR registration */
  dispose: () => void;
} {
  // Build the initial element
  const currentElement = component();

  const entry = {
    component,
    container,
    currentElement,
    disposeCallbacks: [] as Array<() => void>,
  };

  hmrRegistry.set(id, entry);

  // If a container was provided, append the initial element
  if (container) {
    container.appendChild(currentElement);
  }

  function update(newComponent: () => HTMLElement): void {
    const reg = hmrRegistry.get(id);
    if (!reg) return;

    // Run any registered dispose callbacks before swapping
    for (const cb of reg.disposeCallbacks) {
      try {
        cb();
      } catch {
        // swallow errors during dispose
      }
    }
    reg.disposeCallbacks.length = 0;

    // Render the new version
    const newElement = newComponent();

    // Replace the old element in the DOM
    if (reg.currentElement?.parentNode) {
      reg.currentElement.parentNode.replaceChild(newElement, reg.currentElement);
    }

    // Update the registry entry
    reg.component = newComponent;
    reg.currentElement = newElement;
  }

  function dispose(): void {
    const reg = hmrRegistry.get(id);
    if (!reg) return;

    for (const cb of reg.disposeCallbacks) {
      try {
        cb();
      } catch {
        // swallow
      }
    }

    // Remove the element from the DOM
    if (reg.currentElement?.parentNode) {
      reg.currentElement.parentNode.removeChild(reg.currentElement);
    }

    hmrRegistry.delete(id);
  }

  return { update, dispose };
}

// ---------------------------------------------------------------------------
// createHMRBoundary
// ---------------------------------------------------------------------------

/**
 * Create an HMR boundary.
 * Components within the boundary are hot-reloaded independently.  The boundary
 * keeps track of accept/dispose callbacks and can wrap a component factory so
 * that hot updates are handled transparently.
 *
 * @param id  Stable boundary identifier
 * @returns Boundary helpers: `wrap`, `accept`, `dispose`
 *
 * @example
 * ```ts
 * const boundary = createHMRBoundary("settings-panel");
 *
 * const el = boundary.wrap(() => SettingsPanel());
 * document.body.appendChild(el);
 *
 * boundary.accept(() => console.log("Hot update accepted"));
 * boundary.dispose(() => console.log("Cleaning up old version"));
 * ```
 */
export function createHMRBoundary(id: string): {
  /** Wrap a component for HMR support */
  wrap: (component: () => HTMLElement) => HTMLElement;
  /** Accept a hot update */
  accept: (callback?: () => void) => void;
  /** Dispose callback */
  dispose: (callback: () => void) => void;
} {
  let currentElement: HTMLElement | null = null;
  let currentComponent: (() => HTMLElement) | null = null;
  const acceptCallbacks: Array<() => void> = [];
  const disposeCallbacks: Array<() => void> = [];

  /**
   * Wrap a component factory so that it can be hot-swapped later.
   * A wrapper `<div data-hmr-boundary="<id>">` is inserted around the
   * component to act as a stable mount point.
   */
  function wrap(component: () => HTMLElement): HTMLElement {
    currentComponent = component;

    // Create a boundary wrapper that stays in the DOM across reloads
    const wrapper = document.createElement("div");
    wrapper.setAttribute("data-hmr-boundary", id);

    const element = component();
    currentElement = element;
    wrapper.appendChild(element);

    // Store reference in the registry so registerHMR can find it
    hmrRegistry.set(`boundary:${id}`, {
      component,
      container: wrapper,
      currentElement: element,
      disposeCallbacks,
    });

    return wrapper;
  }

  /**
   * Accept a hot update.  When the boundary receives a new component
   * implementation the accept callbacks are invoked and the old element
   * is replaced.
   */
  function accept(callback?: () => void): void {
    if (callback) {
      acceptCallbacks.push(callback);
    }

    // If there is a bundler HMR API available, hook into it
    if (typeof (globalThis as unknown as Record<string, unknown>).__SIBU_HMR_ACCEPT__ === "function") {
      ((globalThis as unknown as Record<string, unknown>).__SIBU_HMR_ACCEPT__ as (id: string, cb: () => void) => void)(
        id,
        () => {
          // Run dispose callbacks
          for (const cb of disposeCallbacks) {
            try {
              cb();
            } catch {
              /* swallow */
            }
          }
          disposeCallbacks.length = 0;

          // Re-render with the current (updated) component
          if (currentComponent && currentElement?.parentNode) {
            const newElement = currentComponent();
            currentElement.parentNode.replaceChild(newElement, currentElement);
            currentElement = newElement;
          }

          // Run accept callbacks
          for (const cb of acceptCallbacks) {
            try {
              cb();
            } catch {
              /* swallow */
            }
          }
        },
      );
    }
  }

  /**
   * Register a dispose callback that runs before the old component is
   * torn down during a hot update.
   */
  function disposeFn(callback: () => void): void {
    disposeCallbacks.push(callback);
  }

  return { wrap, accept, dispose: disposeFn };
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/**
 * Clear all HMR state (useful for a full page refresh or test teardown).
 */
export function clearHMRState(): void {
  hmrStateStore.clear();
  hmrRegistry.clear();
}

/**
 * Check if HMR is available in the current environment.
 * Returns `true` when any of the common bundler HMR APIs are detected
 * (`module.hot` for Webpack, `import.meta.hot` for Vite, or the SibuJS
 * custom hook).
 */
export function isHMRAvailable(): boolean {
  const g = globalThis as unknown as Record<string, unknown>;

  // Webpack
  if ((g.module as Record<string, unknown> | undefined)?.hot) {
    return true;
  }

  // Vite / generic import.meta.hot — import.meta is not accessible at
  // runtime via globalThis, so we check for the SibuJS custom hook instead.
  if (typeof g.__SIBU_HMR_ACCEPT__ === "function") {
    return true;
  }

  // Parcel
  if ((g.module as Record<string, unknown> | undefined)?.hot) {
    return true;
  }

  return false;
}
