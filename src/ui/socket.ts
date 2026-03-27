import { signal } from "../core/signals/signal";

/**
 * socket provides a reactive WebSocket connection with auto-reconnect
 * and optional heartbeat support.
 */
export function socket(
  url: string | (() => string),
  options?: {
    protocols?: string | string[];
    autoReconnect?: boolean;
    reconnectDelay?: number;
    maxReconnects?: number;
    heartbeat?: { interval: number; message: string };
  },
): {
  data: () => unknown;
  status: () => "connecting" | "open" | "closing" | "closed";
  send: (data: string | ArrayBufferLike | Blob) => void;
  close: () => void;
  dispose: () => void;
} {
  const autoReconnect = options?.autoReconnect ?? false;
  const reconnectDelay = options?.reconnectDelay ?? 1000;
  const maxReconnects = options?.maxReconnects ?? Infinity;
  const heartbeat = options?.heartbeat;
  const protocols = options?.protocols;

  const [data, setData] = signal<unknown>(null);
  const [status, setStatus] = signal<"connecting" | "open" | "closing" | "closed">("closed");

  let ws: WebSocket | null = null;
  let reconnectCount = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let disposed = false;

  function getUrl(): string {
    return typeof url === "function" ? url() : url;
  }

  function connect(): void {
    if (disposed) return;

    setStatus("connecting");
    ws = new WebSocket(getUrl(), protocols);

    ws.onopen = () => {
      setStatus("open");
      reconnectCount = 0;
      startHeartbeat();
    };

    ws.onmessage = (event: MessageEvent) => {
      setData(event.data);
    };

    ws.onclose = () => {
      setStatus("closed");
      stopHeartbeat();
      if (autoReconnect && !disposed && reconnectCount < maxReconnects) {
        reconnectCount++;
        reconnectTimer = setTimeout(() => {
          connect();
        }, reconnectDelay);
      }
    };

    ws.onerror = () => {
      // Error will be followed by close event
    };
  }

  function startHeartbeat(): void {
    if (!heartbeat) return;
    stopHeartbeat();
    heartbeatTimer = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(heartbeat.message);
      }
    }, heartbeat.interval);
  }

  function stopHeartbeat(): void {
    if (heartbeatTimer !== null) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  function send(msg: string | ArrayBufferLike | Blob): void {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  }

  function close(): void {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    stopHeartbeat();
    if (ws) {
      setStatus("closing");
      ws.close();
    }
  }

  function dispose(): void {
    disposed = true;
    close();
  }

  // Auto-connect on creation
  connect();

  return { data, status, send, close, dispose };
}
