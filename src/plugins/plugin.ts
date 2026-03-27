// ============================================================================
// PLUGIN ARCHITECTURE
// ============================================================================

export interface PluginContext {
  /** Register a global hook */
  onInit: (callback: () => void) => void;
  onMount: (callback: (element: HTMLElement) => void) => void;
  onUnmount: (callback: (element: HTMLElement) => void) => void;
  onError: (callback: (error: Error) => void) => void;
  /** Provide a value globally */
  provide: (key: string, value: unknown) => void;
}

export interface SibuPlugin {
  name: string;
  install: (ctx: PluginContext, options?: unknown) => void;
}

interface PluginHooks {
  init: Array<() => void>;
  mount: Array<(element: HTMLElement) => void>;
  unmount: Array<(element: HTMLElement) => void>;
  error: Array<(error: Error) => void>;
}

const installedPlugins = new Set<string>();
const hooks: PluginHooks = {
  init: [],
  mount: [],
  unmount: [],
  error: [],
};
const provided = new Map<string, unknown>();

/**
 * Creates a plugin definition.
 */
export function createPlugin(name: string, install: (ctx: PluginContext, options?: unknown) => void): SibuPlugin {
  return { name, install };
}

/**
 * Installs a plugin into the application.
 */
export function plugin(plugin: SibuPlugin, options?: unknown): void {
  if (installedPlugins.has(plugin.name)) {
    console.warn(`[Plugin] "${plugin.name}" is already installed.`);
    return;
  }

  const ctx: PluginContext = {
    onInit: (cb) => hooks.init.push(cb),
    onMount: (cb) => hooks.mount.push(cb),
    onUnmount: (cb) => hooks.unmount.push(cb),
    onError: (cb) => hooks.error.push(cb),
    provide: (key, value) => provided.set(key, value),
  };

  const initHooksBefore = hooks.init.length;
  plugin.install(ctx, options);
  installedPlugins.add(plugin.name);

  // Run only the init hooks added by this plugin (not all hooks)
  for (let i = initHooksBefore; i < hooks.init.length; i++) {
    try {
      hooks.init[i]();
    } catch (e) {
      console.error(`[Plugin] "${plugin.name}" init error:`, e);
    }
  }
}

/**
 * Retrieve a value provided by a plugin.
 */
export function inject<T = unknown>(key: string, defaultValue?: T): T {
  if (provided.has(key)) {
    return provided.get(key) as T;
  }
  if (defaultValue !== undefined) {
    return defaultValue;
  }
  throw new Error(`[Plugin] No provider found for key "${key}"`);
}

/**
 * Trigger mount hooks for an element.
 */
export function triggerPluginMount(element: HTMLElement): void {
  for (const hook of hooks.mount) {
    try {
      hook(element);
    } catch (e) {
      console.error("[Plugin] Mount hook error:", e);
    }
  }
}

/**
 * Trigger unmount hooks for an element.
 */
export function triggerPluginUnmount(element: HTMLElement): void {
  for (const hook of hooks.unmount) {
    try {
      hook(element);
    } catch (e) {
      console.error("[Plugin] Unmount hook error:", e);
    }
  }
}

/**
 * Trigger error hooks.
 */
export function triggerPluginError(error: Error): void {
  for (const hook of hooks.error) {
    try {
      hook(error);
    } catch (e) {
      console.error("[Plugin] Error hook error:", e);
    }
  }
}

/**
 * Reset all plugins (useful for testing).
 */
export function resetPlugins(): void {
  installedPlugins.clear();
  hooks.init.length = 0;
  hooks.mount.length = 0;
  hooks.unmount.length = 0;
  hooks.error.length = 0;
  provided.clear();
}
