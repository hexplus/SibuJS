// ============================================================================
// PRIORITY-BASED UPDATE SCHEDULER
// ============================================================================

export const Priority = {
  IMMEDIATE: 0,
  USER_BLOCKING: 1,
  NORMAL: 2,
  LOW: 3,
  IDLE: 4,
} as const;

export type PriorityLevel = (typeof Priority)[keyof typeof Priority];

interface ScheduledTask {
  id: number;
  priority: PriorityLevel;
  callback: () => void;
  cancelled: boolean;
}

let taskIdCounter = 0;
const taskQueue: ScheduledTask[] = [];
let isProcessing = false;
let frameId: number | null = null;

function insertTask(task: ScheduledTask): void {
  // Insert in priority order (lower number = higher priority)
  let i = taskQueue.length;
  while (i > 0 && taskQueue[i - 1].priority > task.priority) {
    i--;
  }
  taskQueue.splice(i, 0, task);
}

function processQueue(): void {
  if (isProcessing || taskQueue.length === 0) return;
  isProcessing = true;

  const startTime = performance.now();
  const timeSlice = 5; // 5ms time slice per frame

  while (taskQueue.length > 0) {
    const task = taskQueue[0];

    if (task.cancelled) {
      taskQueue.shift();
      continue;
    }

    // For non-immediate tasks, check if we've exceeded our time slice
    if (task.priority > Priority.IMMEDIATE && performance.now() - startTime > timeSlice) {
      break;
    }

    taskQueue.shift();
    try {
      task.callback();
    } catch (e) {
      console.error("[Scheduler] Task error:", e);
    }
  }

  isProcessing = false;

  // Schedule next frame if there are remaining tasks
  if (taskQueue.length > 0) {
    scheduleFrame();
  }
}

function scheduleFrame(): void {
  if (frameId !== null) return;

  const nextTask = taskQueue.find((t) => !t.cancelled);
  if (!nextTask) return;

  if (nextTask.priority <= Priority.USER_BLOCKING) {
    // High priority — use microtask
    queueMicrotask(() => {
      frameId = null;
      processQueue();
    });
    frameId = -1;
  } else if (nextTask.priority === Priority.IDLE) {
    // Idle priority — use requestIdleCallback if available
    if (typeof requestIdleCallback !== "undefined") {
      frameId = requestIdleCallback(() => {
        frameId = null;
        processQueue();
      }) as unknown as number;
    } else {
      frameId = setTimeout(() => {
        frameId = null;
        processQueue();
      }, 50) as unknown as number;
    }
  } else {
    // Normal/Low priority — use requestAnimationFrame
    frameId = requestAnimationFrame(() => {
      frameId = null;
      processQueue();
    });
  }
}

/**
 * Schedule an update with a given priority level.
 * Returns a cancel function.
 */
export function scheduleUpdate(priority: PriorityLevel, callback: () => void): () => void {
  const task: ScheduledTask = {
    id: taskIdCounter++,
    priority,
    callback,
    cancelled: false,
  };

  if (priority === Priority.IMMEDIATE) {
    // Execute synchronously
    try {
      callback();
    } catch (e) {
      console.error("[Scheduler] Immediate task error:", e);
    }
    return () => {};
  }

  insertTask(task);
  scheduleFrame();

  return () => {
    task.cancelled = true;
  };
}

/**
 * Flush all pending tasks synchronously (useful for testing).
 */
export function flushScheduler(): void {
  while (taskQueue.length > 0) {
    const task = taskQueue.shift();
    if (!task) break;
    if (!task.cancelled) {
      task.callback();
    }
  }
  isProcessing = false;
  frameId = null;
}

/**
 * Get the number of pending tasks.
 */
export function pendingTasks(): number {
  return taskQueue.filter((t) => !t.cancelled).length;
}

// ============================================================================
// COOPERATIVE YIELDING
// ============================================================================

/**
 * Yield control back to the main thread, allowing the browser to process
 * user input, rendering, and other high-priority work.
 *
 * Uses `scheduler.yield()` when available (Chrome 115+),
 * falls back to `setTimeout(0)`.
 *
 * @example
 * ```ts
 * for (let i = 0; i < items.length; i++) {
 *   renderItem(items[i]);
 *   if (i % 50 === 0) await yieldToMain();
 * }
 * ```
 */
export function yieldToMain(): Promise<void> {
  if (
    typeof globalThis !== "undefined" &&
    "scheduler" in globalThis &&
    typeof (globalThis as unknown as Record<string, Record<string, unknown>>).scheduler?.yield === "function"
  ) {
    return (globalThis as unknown as { scheduler: { yield: () => Promise<void> } }).scheduler.yield();
  }
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

/**
 * Process an array in chunks, yielding to the main thread between chunks.
 * Prevents long-running loops from blocking the UI.
 *
 * @param items Array of items to process
 * @param processor Callback invoked for each item
 * @param chunkSize Number of items per chunk before yielding (default: 50)
 */
export async function processInChunks<T>(
  items: T[],
  processor: (item: T, index: number) => void,
  chunkSize = 50,
): Promise<void> {
  for (let i = 0; i < items.length; i++) {
    processor(items[i], i);
    if (i > 0 && i % chunkSize === 0) {
      await yieldToMain();
    }
  }
}
