/**
 * E2E testing utilities and mocks for SibuJS.
 * Provides DOM fakes, HTTP mocks, and testing helpers for CI/CD integration.
 */

// ─── HTTP Mock ──────────────────────────────────────────────────────────────

export interface MockResponse {
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  body?: unknown;
  /** Delay before responding in ms */
  delay?: number;
}

export interface MockRoute {
  method?: string; // default: GET
  url: string | RegExp;
  response:
    | MockResponse
    | ((req: { url: string; method: string; body: unknown; headers: Headers }) => MockResponse | Promise<MockResponse>);
}

/**
 * Create an HTTP mock server that intercepts fetch calls.
 * Useful for testing components that make API calls.
 */
export function createHttpMock(routes: MockRoute[] = []) {
  const originalFetch = globalThis.fetch;
  const requestLog: Array<{ url: string; method: string; body: unknown; timestamp: number }> = [];
  const mockRoutes = [...routes];

  function matchRoute(url: string, method: string): MockRoute | undefined {
    return mockRoutes.find((route) => {
      const methodMatch = !route.method || route.method.toUpperCase() === method.toUpperCase();
      if (!methodMatch) return false;
      if (typeof route.url === "string") return url === route.url || url.endsWith(route.url);
      return route.url.test(url);
    });
  }

  const mockFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method || "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;

    requestLog.push({ url, method, body, timestamp: Date.now() });

    const route = matchRoute(url, method);
    if (!route) {
      return new Response(JSON.stringify({ error: "Not mocked" }), { status: 404 });
    }

    let mockResponse: MockResponse;
    if (typeof route.response === "function") {
      mockResponse = await route.response({ url, method, body, headers: new Headers(init?.headers) });
    } else {
      mockResponse = route.response;
    }

    if (mockResponse.delay) {
      await new Promise((r) => setTimeout(r, mockResponse.delay));
    }

    return new Response(typeof mockResponse.body === "string" ? mockResponse.body : JSON.stringify(mockResponse.body), {
      status: mockResponse.status || 200,
      statusText: mockResponse.statusText || "OK",
      headers: mockResponse.headers,
    });
  };

  return {
    /** Install the mock (replace global fetch) */
    install(): void {
      globalThis.fetch = mockFetch as typeof fetch;
    },
    /** Restore original fetch */
    restore(): void {
      globalThis.fetch = originalFetch;
    },
    /** Add a mock route */
    addRoute(route: MockRoute): void {
      mockRoutes.push(route);
    },
    /** Remove all mock routes */
    clearRoutes(): void {
      mockRoutes.length = 0;
    },
    /** Get the request log */
    getRequests(): typeof requestLog {
      return [...requestLog];
    },
    /** Clear the request log */
    clearLog(): void {
      requestLog.length = 0;
    },
    /** Assert that a URL was called */
    assertCalled(url: string, method = "GET"): void {
      const found = requestLog.some((r) => r.url.includes(url) && r.method.toUpperCase() === method.toUpperCase());
      if (!found) throw new Error(`Expected ${method} ${url} to have been called`);
    },
    /** Assert that a URL was NOT called */
    assertNotCalled(url: string, method = "GET"): void {
      const found = requestLog.some((r) => r.url.includes(url) && r.method.toUpperCase() === method.toUpperCase());
      if (found) throw new Error(`Expected ${method} ${url} to NOT have been called`);
    },
    /** Get number of times a URL was called */
    callCount(url: string, method = "GET"): number {
      return requestLog.filter((r) => r.url.includes(url) && r.method.toUpperCase() === method.toUpperCase()).length;
    },
  };
}

// ─── Timer Mock ─────────────────────────────────────────────────────────────

/**
 * Create a fake timer system for testing time-dependent code.
 * Mocks setTimeout, setInterval, requestAnimationFrame.
 */
export function createTimerMock() {
  const originalSetTimeout = globalThis.setTimeout;
  const originalSetInterval = globalThis.setInterval;
  const originalClearTimeout = globalThis.clearTimeout;
  const originalClearInterval = globalThis.clearInterval;
  const originalRAF = typeof requestAnimationFrame !== "undefined" ? requestAnimationFrame : undefined;
  const originalCAF = typeof cancelAnimationFrame !== "undefined" ? cancelAnimationFrame : undefined;

  let currentTime = 0;
  let nextId = 1;
  const timers: Array<{ id: number; callback: () => void; time: number; interval?: number }> = [];

  return {
    install(): void {
      currentTime = 0;
      (globalThis as unknown as Record<string, unknown>).setTimeout = (cb: () => void, delay = 0) => {
        const id = nextId++;
        timers.push({ id, callback: cb, time: currentTime + delay });
        return id;
      };
      (globalThis as unknown as Record<string, unknown>).setInterval = (cb: () => void, interval: number) => {
        const id = nextId++;
        timers.push({ id, callback: cb, time: currentTime + interval, interval });
        return id;
      };
      (globalThis as unknown as Record<string, unknown>).clearTimeout = (id: number) => {
        const idx = timers.findIndex((t) => t.id === id);
        if (idx !== -1) timers.splice(idx, 1);
      };
      (globalThis as unknown as Record<string, unknown>).clearInterval = (id: number) => {
        const idx = timers.findIndex((t) => t.id === id);
        if (idx !== -1) timers.splice(idx, 1);
      };
      (globalThis as unknown as Record<string, unknown>).requestAnimationFrame = (cb: (time: number) => void) => {
        const id = nextId++;
        timers.push({ id, callback: () => cb(currentTime), time: currentTime + 16 });
        return id;
      };
      (globalThis as unknown as Record<string, unknown>).cancelAnimationFrame = (id: number) => {
        const idx = timers.findIndex((t) => t.id === id);
        if (idx !== -1) timers.splice(idx, 1);
      };
    },
    restore(): void {
      globalThis.setTimeout = originalSetTimeout;
      globalThis.setInterval = originalSetInterval;
      globalThis.clearTimeout = originalClearTimeout;
      globalThis.clearInterval = originalClearInterval;
      if (originalRAF) (globalThis as unknown as Record<string, unknown>).requestAnimationFrame = originalRAF;
      if (originalCAF) (globalThis as unknown as Record<string, unknown>).cancelAnimationFrame = originalCAF;
      timers.length = 0;
    },
    /** Advance time by a given number of ms, running any timers that fire */
    advance(ms: number): void {
      const targetTime = currentTime + ms;
      while (true) {
        // Sort by time and find next timer
        timers.sort((a, b) => a.time - b.time);
        const next = timers.find((t) => t.time <= targetTime);
        if (!next) break;
        currentTime = next.time;
        const idx = timers.indexOf(next);
        if (next.interval) {
          next.time += next.interval;
        } else {
          timers.splice(idx, 1);
        }
        next.callback();
      }
      currentTime = targetTime;
    },
    /** Run all pending timers immediately */
    flush(): void {
      const maxIterations = 1000;
      let i = 0;
      while (timers.length > 0 && i++ < maxIterations) {
        timers.sort((a, b) => a.time - b.time);
        const next = timers[0];
        currentTime = next.time;
        if (next.interval) {
          next.time += next.interval;
        } else {
          timers.shift();
        }
        next.callback();
      }
    },
    /** Get current fake time */
    now(): number {
      return currentTime;
    },
    /** Get number of pending timers */
    pendingCount(): number {
      return timers.length;
    },
  };
}

// ─── DOM Snapshot Testing ───────────────────────────────────────────────────

/**
 * Create a serializable snapshot of a DOM element for comparison testing.
 */
export function createDOMSnapshot(element: Element): string {
  return serializeElement(element, 0);
}

function serializeElement(el: Element, indent: number): string {
  const pad = "  ".repeat(indent);
  const tag = el.tagName.toLowerCase();

  // Attributes
  const attrs = Array.from(el.attributes)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((a) => `${a.name}="${a.value}"`)
    .join(" ");

  const open = attrs ? `${pad}<${tag} ${attrs}>` : `${pad}<${tag}>`;

  // Children
  const children = Array.from(el.childNodes);
  if (children.length === 0) {
    return `${open}</${tag}>`;
  }

  if (children.length === 1 && children[0].nodeType === 3) {
    const text = children[0].textContent?.trim() || "";
    return `${open}${text}</${tag}>`;
  }

  const childStr = children
    .map((child) => {
      if (child.nodeType === 3) {
        const text = child.textContent?.trim();
        return text ? `${"  ".repeat(indent + 1)}${text}` : "";
      }
      if (child.nodeType === 1) {
        return serializeElement(child as Element, indent + 1);
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");

  return `${open}\n${childStr}\n${pad}</${tag}>`;
}

/**
 * Assert that two DOM trees are structurally equivalent.
 */
export function assertDOMEquals(actual: Element, expected: Element): void {
  const actualSnapshot = createDOMSnapshot(actual);
  const expectedSnapshot = createDOMSnapshot(expected);
  if (actualSnapshot !== expectedSnapshot) {
    throw new Error(`DOM mismatch:\n\nActual:\n${actualSnapshot}\n\nExpected:\n${expectedSnapshot}`);
  }
}

// ─── Component Test Wrapper ─────────────────────────────────────────────────

/**
 * Wrap a component for isolated testing with automatic cleanup.
 */
export function testComponent(
  component: (() => HTMLElement) | HTMLElement,
  options: { container?: HTMLElement } = {},
): {
  element: HTMLElement;
  container: HTMLElement;
  /** Find element by test ID (data-testid attribute) */
  getByTestId: (id: string) => Element | null;
  /** Find all elements by test ID */
  getAllByTestId: (id: string) => Element[];
  /** Find by text content */
  getByText: (text: string) => Element | null;
  /** Simulate click */
  click: (el: Element) => void;
  /** Simulate input */
  type: (el: HTMLInputElement, value: string) => void;
  /** Wait for reactive updates */
  waitForUpdate: () => Promise<void>;
  /** Clean up */
  destroy: () => void;
} {
  const container = options.container || document.createElement("div");
  if (!options.container) document.body.appendChild(container);
  const element = typeof component === "function" ? component() : component;
  container.appendChild(element);

  return {
    element,
    container,
    getByTestId(id: string) {
      return container.querySelector(`[data-testid="${id}"]`);
    },
    getAllByTestId(id: string) {
      return Array.from(container.querySelectorAll(`[data-testid="${id}"]`));
    },
    getByText(text: string) {
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        if (walker.currentNode.textContent?.includes(text)) {
          return walker.currentNode.parentElement;
        }
      }
      return null;
    },
    click(el: Element) {
      el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    },
    type(el: HTMLInputElement, value: string) {
      el.value = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    },
    async waitForUpdate() {
      await new Promise((r) => setTimeout(r, 0));
    },
    destroy() {
      if (container.parentNode) container.parentNode.removeChild(container);
    },
  };
}
