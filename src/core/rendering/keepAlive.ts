import { track } from "../../reactivity/track";
import { dispose } from "./dispose";

/**
 * Options for KeepAlive.
 */
export interface KeepAliveOptions {
  /** Maximum cached components. Oldest evicted (and disposed) when exceeded. */
  max?: number;
}

/**
 * Caches component DOM subtrees by key, preserving reactive bindings
 * when switching between views. Unlike `when()`/`match()`, toggling
 * does NOT dispose the previous branch — it detaches and stashes it,
 * so signals, effects, scroll position, and form state survive.
 *
 * When a key is evicted (via `max` limit), its subtree is properly
 * disposed to free reactive subscriptions.
 *
 * @param activeKey Reactive getter returning the current active key
 * @param cases Map of key → factory function that creates the component
 * @param options Optional: `{ max }` to cap cache size
 * @returns A Comment anchor node (same pattern as `when`, `match`, `each`)
 *
 * @example
 * ```ts
 * const [tab, setTab] = signal("home");
 *
 * KeepAlive(
 *   () => tab(),
 *   {
 *     home: () => HomePage(),
 *     settings: () => SettingsPage(),
 *     profile: () => ProfilePage(),
 *   },
 *   { max: 5 }
 * );
 * ```
 */
export function KeepAlive(
  activeKey: () => string,
  cases: Record<string, () => Node>,
  options?: KeepAliveOptions,
): Comment {
  const anchor = document.createComment("keep-alive");
  const cache = new Map<string, Node>();
  const lruOrder: string[] = [];
  const max = options?.max ?? 0;

  let currentKey: string | undefined;
  let currentNode: Node | null = null;
  let initialized = false;

  const update = () => {
    const key = activeKey();

    const parent = anchor.parentNode;
    if (!parent) return;

    // Skip if same key
    if (initialized && key === currentKey) return;

    // Detach current node (WITHOUT disposing — keep reactive bindings alive)
    if (currentNode?.parentNode) {
      parent.removeChild(currentNode);
    }

    currentKey = key;

    // Retrieve from cache or create new
    let node = cache.get(key);
    if (!node) {
      const factory = cases[key];
      if (!factory) {
        currentNode = null;
        initialized = true;
        return;
      }
      node = factory();
      cache.set(key, node);
      lruOrder.push(key);

      // Evict oldest if over max
      if (max > 0 && lruOrder.length > max) {
        const evictKey = lruOrder.shift()!;
        const evictNode = cache.get(evictKey);
        if (evictNode) {
          dispose(evictNode);
          if (evictNode.parentNode) evictNode.parentNode.removeChild(evictNode);
          cache.delete(evictKey);
        }
      }
    } else {
      // Move to end of LRU (most recently used)
      const idx = lruOrder.indexOf(key);
      if (idx !== -1) {
        lruOrder.splice(idx, 1);
        lruOrder.push(key);
      }
    }

    // Insert cached/new node after anchor
    parent.insertBefore(node, anchor.nextSibling);
    currentNode = node;
    initialized = true;
  };

  track(update);

  if (!initialized) {
    queueMicrotask(() => {
      if (!initialized && anchor.parentNode) update();
    });
  }

  return anchor;
}
