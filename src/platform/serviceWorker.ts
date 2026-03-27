import { signal } from "../core/signals/signal";

// ============================================================================
// SERVICE WORKER INTEGRATION
// ============================================================================

export interface ServiceWorkerState {
  registration: () => ServiceWorkerRegistration | null;
  isReady: () => boolean;
  isUpdateAvailable: () => boolean;
  error: () => Error | null;
  update: () => Promise<void>;
  unregister: () => Promise<boolean>;
}

/**
 * serviceWorker registers and manages a service worker.
 */
export function serviceWorker(scriptUrl: string, options?: RegistrationOptions): ServiceWorkerState {
  const [registration, setRegistration] = signal<ServiceWorkerRegistration | null>(null);
  const [isReady, setIsReady] = signal(false);
  const [isUpdateAvailable, setIsUpdateAvailable] = signal(false);
  const [error, setError] = signal<Error | null>(null);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register(scriptUrl, options)
      .then((reg) => {
        setRegistration(reg);
        setIsReady(true);

        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                setIsUpdateAvailable(true);
              }
            });
          }
        });
      })
      .catch((err) => {
        setError(err instanceof Error ? err : new Error(String(err)));
      });
  }

  async function update(): Promise<void> {
    const reg = registration();
    if (reg) {
      await reg.update();
    }
  }

  async function unregister(): Promise<boolean> {
    const reg = registration();
    if (reg) {
      const result = await reg.unregister();
      if (result) {
        setRegistration(null);
        setIsReady(false);
      }
      return result;
    }
    return false;
  }

  return { registration, isReady, isUpdateAvailable, error, update, unregister };
}
