import { signal } from "../core/signals/signal";

export interface ISROptions<T> {
  revalidateAfter: number; // ms
  fetcher: () => Promise<T>;
  initialData?: T;
}

/**
 * Creates an Incremental Static Regeneration (ISR) resource.
 * Data is fetched initially, then automatically revalidated after the
 * specified interval using setInterval.
 */
export function createISR<T>(options: ISROptions<T>): {
  data: () => T | undefined;
  isStale: () => boolean;
  revalidate: () => Promise<void>;
  dispose: () => void;
} {
  const { revalidateAfter, fetcher, initialData } = options;

  const [data, setData] = signal<T | undefined>(initialData);
  const [timestamp, setTimestamp] = signal<number>(initialData !== undefined ? Date.now() : 0);

  const isStale = (): boolean => {
    const ts = timestamp();
    if (ts === 0) return true;
    return Date.now() - ts >= revalidateAfter;
  };

  const revalidate = async (): Promise<void> => {
    const result = await fetcher();
    setData(result);
    setTimestamp(Date.now());
  };

  // Perform initial fetch if no initial data provided
  if (initialData === undefined) {
    revalidate();
  }

  // Set up automatic revalidation interval
  const intervalId = setInterval(() => {
    revalidate();
  }, revalidateAfter);

  const dispose = (): void => {
    clearInterval(intervalId);
  };

  return { data, isStale, revalidate, dispose };
}
