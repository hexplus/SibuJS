/**
 * Advanced runtime chunk loading with caching strategies for SibuJS.
 * Provides configurable caching, preloading, retry logic, and loading orchestration.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ChunkConfig {
  /** Maximum number of cached chunks */
  maxCacheSize?: number;
  /** Cache TTL in milliseconds (0 = no expiry) */
  cacheTTL?: number;
  /** Number of retry attempts on failure */
  retries?: number;
  /** Delay between retries in ms */
  retryDelay?: number;
  /** Timeout for chunk loading in ms */
  timeout?: number;
  /** Called when a chunk starts loading */
  onLoadStart?: (id: string) => void;
  /** Called when a chunk finishes loading */
  onLoadEnd?: (id: string) => void;
  /** Called when a chunk fails to load */
  onLoadError?: (id: string, error: Error) => void;
}

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  accessCount: number;
}

// ─── ChunkRegistry ─────────────────────────────────────────────────────────

/**
 * Central registry for managing dynamic chunks with caching and lifecycle callbacks.
 */
export function createChunkRegistry(config: ChunkConfig = {}) {
  const {
    maxCacheSize = 50,
    cacheTTL = 0,
    retries = 2,
    retryDelay = 1000,
    timeout = 10000,
    onLoadStart,
    onLoadEnd,
    onLoadError,
  } = config;

  const cache = new Map<string, CacheEntry<unknown>>();
  const pending = new Map<string, Promise<unknown>>();
  const preloaded = new Set<string>();

  // Evict oldest/least-accessed entry when cache is full
  function evict() {
    if (cache.size < maxCacheSize) return;
    let oldest: string | null = null;
    let oldestTime = Infinity;
    for (const [key, entry] of cache) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldest = key;
      }
    }
    if (oldest) cache.delete(oldest);
  }

  // Check if cached entry is still valid
  function isValid(entry: CacheEntry<unknown>): boolean {
    if (cacheTTL === 0) return true;
    return Date.now() - entry.timestamp < cacheTTL;
  }

  // Load with retry logic
  async function loadWithRetry<T>(id: string, loader: () => Promise<T>, attempt = 0): Promise<T> {
    try {
      const result = await (timeout > 0
        ? Promise.race([
            loader(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error(`Chunk '${id}' loading timed out after ${timeout}ms`)), timeout),
            ),
          ])
        : loader());
      return result;
    } catch (err) {
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, retryDelay * (attempt + 1)));
        return loadWithRetry(id, loader, attempt + 1);
      }
      throw err;
    }
  }

  return {
    /**
     * Load a chunk by ID. Uses cache if available, otherwise loads via the provided loader.
     */
    async load<T>(id: string, loader: () => Promise<T>): Promise<T> {
      // Check cache
      const cached = cache.get(id);
      if (cached && isValid(cached)) {
        cached.accessCount++;
        return cached.value as T;
      }

      // Check if already loading (dedup)
      const pendingLoad = pending.get(id);
      if (pendingLoad) return pendingLoad as Promise<T>;

      // Start loading
      onLoadStart?.(id);
      const loadPromise = loadWithRetry(id, loader)
        .then((value) => {
          evict();
          cache.set(id, { value, timestamp: Date.now(), accessCount: 1 });
          pending.delete(id);
          onLoadEnd?.(id);
          return value;
        })
        .catch((err) => {
          pending.delete(id);
          const error = err instanceof Error ? err : new Error(String(err));
          onLoadError?.(id, error);
          throw error;
        });

      pending.set(id, loadPromise as Promise<unknown>);
      return loadPromise;
    },

    /**
     * Preload a chunk without blocking. Silently caches for later use.
     */
    preload<T>(id: string, loader: () => Promise<T>): void {
      if (cache.has(id) || pending.has(id) || preloaded.has(id)) return;
      preloaded.add(id);
      this.load(id, loader).catch(() => {});
    },

    /**
     * Preload multiple chunks in parallel.
     */
    preloadAll(entries: Array<{ id: string; loader: () => Promise<unknown> }>): void {
      for (const entry of entries) {
        this.preload(entry.id, entry.loader);
      }
    },

    /**
     * Check if a chunk is cached and valid.
     */
    has(id: string): boolean {
      const entry = cache.get(id);
      return !!entry && isValid(entry);
    },

    /**
     * Get a cached chunk synchronously. Returns undefined if not cached.
     */
    get<T>(id: string): T | undefined {
      const entry = cache.get(id);
      if (entry && isValid(entry)) {
        entry.accessCount++;
        return entry.value as T;
      }
      return undefined;
    },

    /**
     * Invalidate a cached chunk.
     */
    invalidate(id: string): void {
      cache.delete(id);
    },

    /**
     * Clear all cached chunks.
     */
    clear(): void {
      cache.clear();
      preloaded.clear();
    },

    /**
     * Get cache statistics.
     */
    stats(): {
      size: number;
      maxSize: number;
      pending: number;
      preloaded: number;
    } {
      return {
        size: cache.size,
        maxSize: maxCacheSize,
        pending: pending.size,
        preloaded: preloaded.size,
      };
    },
  };
}

// ─── Lazy Component with Chunk Registry ─────────────────────────────────────

/**
 * Create a lazy-loaded component that uses the chunk registry for caching.
 * Provides automatic retry, timeout, and cache management.
 */
export function lazyChunk(
  id: string,
  loader: () => Promise<{ default: () => HTMLElement } | (() => HTMLElement)>,
  registry: ReturnType<typeof createChunkRegistry>,
  fallback?: () => HTMLElement,
): () => HTMLElement {
  return () => {
    // Check if already cached
    const cached = registry.get<() => HTMLElement>(id);
    if (cached) return cached();

    // Show fallback while loading
    const container = document.createElement("div");
    container.setAttribute("data-chunk", id);

    if (fallback) {
      container.appendChild(fallback());
    }

    registry
      .load(id, async () => {
        const mod = await loader();
        return typeof mod === "function" ? mod : (mod as { default: () => HTMLElement }).default;
      })
      .then((component) => {
        container.innerHTML = "";
        container.appendChild(component());
      })
      .catch((err) => {
        container.innerHTML = "";
        const errorEl = document.createElement("div");
        errorEl.textContent = `Failed to load chunk '${id}': ${err.message}`;
        container.appendChild(errorEl);
      });

    return container;
  };
}

// ─── Module Preloader ───────────────────────────────────────────────────────

/**
 * Preload ES modules using link[rel=modulepreload].
 * Improves loading performance by informing the browser early.
 */
export function preloadModule(url: string): void {
  if (typeof document === "undefined") return;
  const existing = document.querySelector(`link[href="${url}"][rel="modulepreload"]`);
  if (existing) return;
  const link = document.createElement("link");
  link.rel = "modulepreload";
  link.href = url;
  document.head.appendChild(link);
}

/**
 * Preload multiple modules.
 */
export function preloadModules(urls: string[]): void {
  urls.forEach(preloadModule);
}
