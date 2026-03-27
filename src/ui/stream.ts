import { signal } from "../core/signals/signal";

/**
 * stream provides reactive Server-Sent Events (SSE) integration.
 * Wraps the EventSource API with reactive state for data, event name, and connection status.
 */
export function stream(
  url: string,
  options?: {
    withCredentials?: boolean;
    autoReconnect?: boolean;
  },
): {
  data: () => string | null;
  event: () => string | null;
  status: () => "connecting" | "open" | "closed";
  close: () => void;
  dispose: () => void;
} {
  const autoReconnect = options?.autoReconnect ?? false;

  const [data, setData] = signal<string | null>(null);
  const [event, setEvent] = signal<string | null>(null);
  const [status, setStatus] = signal<"connecting" | "open" | "closed">("connecting");

  let source: EventSource | null = null;
  let disposed = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function connect(): void {
    if (disposed) return;

    setStatus("connecting");
    source = new EventSource(url, {
      withCredentials: options?.withCredentials ?? false,
    });

    source.onopen = () => {
      setStatus("open");
    };

    source.onmessage = (evt: MessageEvent) => {
      setData(evt.data);
      setEvent(evt.type);
    };

    source.onerror = () => {
      if (source && source.readyState === EventSource.CLOSED) {
        setStatus("closed");
        source = null;
        if (autoReconnect && !disposed) {
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            connect();
          }, 1000);
        }
      }
    };
  }

  function close(): void {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (source) {
      source.close();
      setStatus("closed");
      source = null;
    }
  }

  function dispose(): void {
    disposed = true;
    close();
  }

  // Auto-connect on creation
  connect();

  return { data, event, status, close, dispose };
}
