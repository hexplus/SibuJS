import { derived } from "../core/signals/derived";
import { signal } from "../core/signals/signal";
import { batch } from "../reactivity/batch";
import type { RetryOptions } from "./retry";
import { withRetry } from "./retry";

export interface MutationOptions<TData, TVariables, TContext = unknown> {
  /** Retry options for failed mutations */
  retry?: RetryOptions;
  /** Called before mutation — return context for rollback in onError */
  onMutate?: (variables: TVariables) => TContext | Promise<TContext>;
  /** Called on successful mutation */
  onSuccess?: (data: TData, variables: TVariables, context: TContext) => void;
  /** Called on mutation error — context from onMutate available for rollback */
  onError?: (error: Error, variables: TVariables, context: TContext | undefined) => void;
  /** Called on mutation settle (success or error) */
  onSettled?: (
    data: TData | undefined,
    error: Error | undefined,
    variables: TVariables,
    context: TContext | undefined,
  ) => void;
}

export interface MutationResult<TData, TVariables> {
  /** Reactive getter for the mutation result data */
  data: () => TData | undefined;
  /** Reactive getter for the loading state */
  loading: () => boolean;
  /** Reactive getter for the error state */
  error: () => Error | undefined;
  /** Reactive getter: true if mutation succeeded */
  isSuccess: () => boolean;
  /** Reactive getter: true if mutation has not been called */
  isIdle: () => boolean;
  /** Fire-and-forget mutation trigger */
  mutate: (variables: TVariables) => void;
  /** Mutation trigger that returns a promise */
  mutateAsync: (variables: TVariables) => Promise<TData>;
  /** Reset state to idle */
  reset: () => void;
}

export function mutation<TData, TVariables = void, TContext = unknown>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: MutationOptions<TData, TVariables, TContext> = {},
): MutationResult<TData, TVariables> {
  const [data, setData] = signal<TData | undefined>(undefined);
  const [loading, setLoading] = signal(false);
  const [error, setError] = signal<Error | undefined>(undefined);
  const [status, setStatus] = signal<"idle" | "loading" | "success" | "error">("idle");

  const isSuccess = derived(() => status() === "success");
  const isIdle = derived(() => status() === "idle");

  async function execute(variables: TVariables): Promise<TData> {
    let context: TContext | undefined;

    batch(() => {
      setLoading(true);
      setError(undefined);
      setStatus("loading");
    });

    try {
      if (options.onMutate) {
        context = await options.onMutate(variables);
      }

      const result = await withRetry(() => mutationFn(variables), options.retry);

      batch(() => {
        setData(result);
        setLoading(false);
        setStatus("success");
      });

      options.onSuccess?.(result, variables, context as TContext);
      options.onSettled?.(result, undefined, variables, context);

      return result;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));

      batch(() => {
        setError(errorObj);
        setLoading(false);
        setStatus("error");
      });

      options.onError?.(errorObj, variables, context);
      options.onSettled?.(undefined, errorObj, variables, context);

      throw errorObj;
    }
  }

  function reset(): void {
    batch(() => {
      setData(undefined);
      setError(undefined);
      setLoading(false);
      setStatus("idle");
    });
  }

  return {
    data,
    loading,
    error,
    isSuccess,
    isIdle,
    mutate: (variables: TVariables) => {
      execute(variables).catch(() => {});
    },
    mutateAsync: execute,
    reset,
  };
}
