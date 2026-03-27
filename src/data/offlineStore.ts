/**
 * Offline-first data store backed by IndexedDB with reactive state.
 * Provides automatic sync when connectivity returns.
 */

import { signal } from "../core/signals/signal";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface OfflineStoreOptions<T> {
  /** IndexedDB database name */
  name: string;
  /** Version for schema migrations */
  version?: number;
  /** Key path in the stored objects (default: "id") */
  keyPath?: string;
  /** Sync adapter for remote push/pull */
  adapter?: SyncAdapter<T>;
  /** Auto-sync when online status changes (default: true) */
  autoSync?: boolean;
}

export interface SyncAdapter<T> {
  /** Push local changes to remote */
  push: (changes: SyncChange<T>[]) => Promise<SyncResult>;
  /** Pull remote changes since last sync */
  pull: (since: number | null) => Promise<T[]>;
  /** Conflict resolution strategy */
  conflictStrategy: "client-wins" | "server-wins" | "manual";
}

export interface SyncChange<T> {
  type: "put" | "delete";
  item: T;
  timestamp: number;
}

export interface SyncResult {
  ok: boolean;
  error?: string;
}

export interface OfflineStore<T> {
  /** Reactive getter for all items */
  data: () => T[];
  /** Get a single item by key */
  get: (key: string | number) => Promise<T | undefined>;
  /** Insert or update an item */
  put: (item: T) => Promise<void>;
  /** Delete an item by key */
  remove: (key: string | number) => Promise<void>;
  /** Query items with a filter */
  query: (filter: (item: T) => boolean) => T[];
  /** Whether a sync is in progress */
  isSyncing: () => boolean;
  /** Timestamp of last successful sync */
  lastSynced: () => number | null;
  /** Trigger a manual sync */
  sync: () => Promise<void>;
  /** Attach a sync adapter */
  attach: (adapter: SyncAdapter<T>) => void;
  /** Number of pending (un-synced) changes */
  pendingCount: () => number;
  /** Close the database connection */
  close: () => void;
}

// ─── IDB Helpers ─────────────────────────────────────────────────────────────

function openDB(name: string, version: number, keyPath: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("items")) {
        db.createObjectStore("items", { keyPath });
      }
      if (!db.objectStoreNames.contains("_changes")) {
        const changeStore = db.createObjectStore("_changes", { autoIncrement: true });
        changeStore.createIndex("timestamp", "timestamp");
      }
      if (!db.objectStoreNames.contains("_meta")) {
        db.createObjectStore("_meta");
      }
    };
  });
}

function idbGetAll<T>(db: IDBDatabase, store: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet<T>(db: IDBDatabase, store: string, key: string | number): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbPut<T>(db: IDBDatabase, store: string, item: T): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function idbDelete(db: IDBDatabase, store: string, key: string | number): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function idbClear(db: IDBDatabase, store: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Main Function ───────────────────────────────────────────────────────────────

/**
 * Create an offline-first reactive store backed by IndexedDB.
 *
 * @example
 * ```ts
 * const store = await offlineStore<Todo>({
 *   name: "todos",
 *   adapter: syncAdapter({
 *     push: (changes) => fetch("/api/sync", { method: "POST", body: JSON.stringify(changes) }),
 *     pull: (since) => fetch(`/api/todos?since=${since}`).then(r => r.json()),
 *     conflictStrategy: "client-wins",
 *   }),
 * });
 *
 * await store.put({ id: "1", text: "Buy milk", done: false });
 * store.data(); // [{ id: "1", text: "Buy milk", done: false }]
 * ```
 */
export async function offlineStore<T extends Record<string, unknown>>(
  options: OfflineStoreOptions<T>,
): Promise<OfflineStore<T>> {
  const { name, version = 1, keyPath = "id", autoSync = true } = options;

  const db = await openDB(name, version, keyPath);
  const initialData = await idbGetAll<T>(db, "items");
  const initialChanges = await idbGetAll<SyncChange<T>>(db, "_changes");
  const savedLastSync = await idbGet<number>(db, "_meta", "lastSynced");

  const [data, setData] = signal<T[]>(initialData);
  const [isSyncing, setIsSyncing] = signal(false);
  const [lastSynced, setLastSynced] = signal<number | null>(savedLastSync ?? null);
  const [pendingCount, setPendingCount] = signal(initialChanges.length);

  let adapter: SyncAdapter<T> | undefined = options.adapter;

  async function refreshData() {
    const items = await idbGetAll<T>(db, "items");
    setData(items);
    const changes = await idbGetAll<SyncChange<T>>(db, "_changes");
    setPendingCount(changes.length);
  }

  async function put(item: T): Promise<void> {
    await idbPut(db, "items", item);
    await idbPut(db, "_changes", { type: "put", item, timestamp: Date.now() } as SyncChange<T>);
    await refreshData();
  }

  async function remove(key: string | number): Promise<void> {
    const existing = await idbGet<T>(db, "items", key);
    if (existing) {
      await idbDelete(db, "items", key);
      await idbPut(db, "_changes", { type: "delete", item: existing, timestamp: Date.now() } as SyncChange<T>);
      await refreshData();
    }
  }

  async function get(key: string | number): Promise<T | undefined> {
    return idbGet<T>(db, "items", key);
  }

  function query(filter: (item: T) => boolean): T[] {
    return data().filter(filter);
  }

  async function sync(): Promise<void> {
    if (!adapter || isSyncing()) return;

    setIsSyncing(true);
    try {
      // Push local changes
      const changes = await idbGetAll<SyncChange<T>>(db, "_changes");
      if (changes.length > 0) {
        const result = await adapter.push(changes);
        if (result.ok) {
          await idbClear(db, "_changes");
        }
      }

      // Pull remote changes
      const remoteItems = await adapter.pull(lastSynced());
      for (const item of remoteItems) {
        await idbPut(db, "items", item);
      }

      const now = Date.now();
      await idbPut(db, "_meta", now);
      setLastSynced(now);
      await refreshData();
    } catch {
      // Sync failed — changes remain in queue for retry
    } finally {
      setIsSyncing(false);
    }
  }

  function attach(newAdapter: SyncAdapter<T>) {
    adapter = newAdapter;
  }

  function close() {
    db.close();
  }

  // Auto-sync when coming online
  if (autoSync && typeof window !== "undefined") {
    window.addEventListener("online", () => {
      sync();
    });
  }

  return {
    data,
    get,
    put,
    remove,
    query,
    isSyncing,
    lastSynced,
    sync,
    attach,
    pendingCount,
    close,
  };
}

/**
 * Helper to create a sync adapter configuration.
 */
export function syncAdapter<T>(config: SyncAdapter<T>): SyncAdapter<T> {
  return config;
}
