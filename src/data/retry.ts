/**
 * Configurable retry strategies for async operations.
 * Used by `resource` and `query` for automatic error recovery.
 */

export interface RetryOptions {
  /** Maximum number of retry attempts. Default: 3 */
  maxRetries?: number;
  /** Retry strategy. Default: "exponential" */
  strategy?: "exponential" | "linear" | "fixed";
  /** Base delay in ms. Default: 1000 */
  baseDelay?: number;
  /** Maximum delay in ms (caps exponential growth). Default: 30000 */
  maxDelay?: number;
  /** Jitter factor (0-1) to randomize delay. Default: 0.1 */
  jitter?: number;
  /** Predicate to decide if an error is retryable. Default: () => true */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

/**
 * Calculate delay for a given attempt based on strategy.
 */
export function calculateDelay(
  attempt: number,
  strategy: "exponential" | "linear" | "fixed",
  baseDelay: number,
  maxDelay: number,
  jitter: number,
): number {
  let delay: number;
  switch (strategy) {
    case "exponential":
      delay = baseDelay * 2 ** attempt;
      break;
    case "linear":
      delay = baseDelay * (attempt + 1);
      break;
    case "fixed":
      delay = baseDelay;
      break;
  }
  delay = Math.min(delay, maxDelay);
  if (jitter > 0) {
    const jitterRange = delay * jitter;
    delay += (Math.random() * 2 - 1) * jitterRange;
  }
  return Math.max(0, delay);
}

/**
 * Execute an async function with retry logic.
 * Returns the result or throws after all retries are exhausted.
 *
 * @param fn The async function to execute
 * @param options Retry configuration
 * @param onRetry Callback fired before each retry with error, attempt, and delay
 * @param signal AbortSignal to cancel retries
 *
 * @example
 * ```ts
 * const data = await withRetry(() => fetch("/api/data").then(r => r.json()), {
 *   maxRetries: 3,
 *   strategy: "exponential",
 *   shouldRetry: (err) => !(err instanceof TypeError),
 * });
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions,
  onRetry?: (error: unknown, attempt: number, delay: number) => void,
  signal?: AbortSignal,
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 3;
  const strategy = options?.strategy ?? "exponential";
  const baseDelay = options?.baseDelay ?? 1000;
  const maxDelay = options?.maxDelay ?? 30000;
  const jitter = options?.jitter ?? 0.1;
  const shouldRetry = options?.shouldRetry ?? (() => true);

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= maxRetries || !shouldRetry(error, attempt)) throw error;
      const delay = calculateDelay(attempt, strategy, baseDelay, maxDelay, jitter);
      onRetry?.(error, attempt, delay);
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, delay);
        if (signal) {
          const onAbort = () => {
            clearTimeout(timer);
            reject(new DOMException("Aborted", "AbortError"));
          };
          signal.addEventListener("abort", onAbort, { once: true });
        }
      });
    }
  }
  throw lastError;
}
