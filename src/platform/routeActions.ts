import { signal } from "../core/signals/signal";
import { batch } from "../reactivity/batch";

export type ActionFn<T = unknown> = (data: FormData | Record<string, unknown>) => Promise<T>;

export interface ActionResult<T> {
  data: () => T | undefined;
  error: () => Error | undefined;
  loading: () => boolean;
  submit: (data: FormData | Record<string, unknown>) => Promise<T>;
}

/**
 * Creates a managed action for handling POST/PUT/DELETE-style mutations.
 * Provides reactive loading, error, and data state via signal.
 * State updates are batched to avoid redundant notifications.
 */
export function createAction<T>(actionFn: ActionFn<T>): ActionResult<T> {
  const [data, setData] = signal<T | undefined>(undefined);
  const [error, setError] = signal<Error | undefined>(undefined);
  const [loading, setLoading] = signal<boolean>(false);

  const submit = async (input: FormData | Record<string, unknown>): Promise<T> => {
    batch(() => {
      setLoading(true);
      setError(undefined);
    });

    try {
      const result = await actionFn(input);
      batch(() => {
        setData(result);
        setLoading(false);
      });
      return result;
    } catch (err) {
      const actionError = err instanceof Error ? err : new Error(String(err));
      batch(() => {
        setError(actionError);
        setLoading(false);
      });
      throw actionError;
    }
  };

  return { data, error, loading, submit };
}
