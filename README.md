# SibuJS

A function-based frontend framework with fine-grained reactivity, direct DOM rendering, and zero compilation. No virtual DOM. No JSX. No magic.

Named after **Sibu** -- the creator deity of the Bribri and Cabecar indigenous peoples of Costa Rica -- representing clarity, harmony, and simplicity in creation.

```
npm install sibujs
```

---

## Quick Start

```ts
import { html, signal, mount } from "sibujs";

function Counter() {
  const [count, setCount] = signal(0);

  return html`<div>
    <h1>${() => `Count: ${count()}`}</h1>
    <button on:click=${() => setCount(c => c + 1)}>Increment</button>
  </div>`;
}

const { unmount } = mount(Counter, document.getElementById("app"));
```

Components are plain functions that return DOM elements. State is a getter/setter pair. Reactive nodes are wrapped in `() =>`. That is the entire mental model.

---

## Three Ways to Write Components

Sibu offers three authoring styles. All produce identical DOM elements and are fully interoperable -- mix them freely.

### 1. `html` Tagged Template

HTML-like syntax using tagged template literals. No compiler needed -- it's a runtime function.

```ts
import { html, signal } from "sibujs";

function Counter() {
  const [count, setCount] = signal(0);

  return html`<div class="counter">
    <h1>${() => `Count: ${count()}`}</h1>
    <button on:click=${() => setCount(c => c + 1)}>Increment</button>
    <button on:click=${() => setCount(0)}>Reset</button>
  </div>`;
}
```

**Best for:** Most components. Familiar HTML syntax, minimal nesting, easy to scan.

### 2. Positional Shorthand

Concise function calls with optional class and children arguments.

```ts
import { div, h1, button, signal } from "sibujs";

function Counter() {
  const [count, setCount] = signal(0);

  return div("counter", [
    h1(() => `Count: ${count()}`),
    button({ nodes: "Increment", on: { click: () => setCount(c => c + 1) } }),
    button({ nodes: "Reset", on: { click: () => setCount(0) } }),
  ]);
}
```

**Signatures:**

- `div("Hello")` -- text only
- `div([child1, child2])` -- children only
- `div("my-class", "Hello")` -- class + text
- `div("my-class", [child1, child2])` -- class + children

**Best for:** Quick layouts where you just need class + children, no events.

### 3. Full Props Object (original API)

Maximum control with explicit props object containing all configuration.

```ts
import { div, h1, button, signal } from "sibujs";

function Counter() {
  const [count, setCount] = signal(0);

  return div({
    class: "counter",
    nodes: [
      h1({ nodes: () => `Count: ${count()}` }),
      button({
        nodes: "Increment",
        on: { click: () => setCount(c => c + 1) },
      }),
      button({
        nodes: "Reset",
        on: { click: () => setCount(0) },
      }),
    ],
  });
}
```

**Best for:** Complex elements with refs, styles, custom attributes, or dynamic props.

### Mixing Styles

All three styles produce the same DOM elements, so you can combine them:

```ts
import { html, div, button, signal } from "sibujs";

function App() {
  const [count, setCount] = signal(0);

  return html`<div class="app">
    <h1>My App</h1>
    ${div("content", [
      html`<p>Count: ${() => count()}</p>`,
      button({ nodes: "Click", on: { click: () => setCount(c => c + 1) } }),
    ])}
  </div>`;
}
```

### Performance by Authoring Style

All three styles produce the same DOM output, but their runtime cost differs:

| Style                                     | First render                                   | Subsequent renders     | With Vite plugin                             |
| ----------------------------------------- | ---------------------------------------------- | ---------------------- | -------------------------------------------- |
| **Props Object / Positional**       | Fastest — direct function calls, zero parsing | Fastest                | No change needed                             |
| **`html\`\`` with build step**    | Same as above — compiled to direct calls      | Same as above          | `compileTemplates: true` (default in prod) |
| **`html\`\`` without build step** | ~1.5x slower — runtime parser runs once       | Same as above (cached) | N/A                                          |

The `html` tagged template parser caches its output per call site using a `WeakMap` keyed by the template's static strings identity. This means:

- **First call** at a given source location pays the parsing cost (~1.5x overhead)
- **Every subsequent call** at the same location skips parsing entirely and replays the cached structure with fresh expression values

With the Vite plugin, even the first-call cost disappears.

### Compiling Templates (Build-Time Optimization)

The Sibu Vite plugin includes a **template compiler** that transforms `html\`...\`` tagged templates into direct function calls at build time. The runtime parser is never loaded — the output is identical to writing Props Object code by hand.

**Setup:**

```ts
// vite.config.ts
import { sibuVitePlugin } from "sibujs/build";

export default {
  plugins: [
    sibuVitePlugin()
    // compileTemplates is enabled by default in production builds
  ]
};
```

**What it does:**

```ts
// Your source code:
const el = html`<div class=${cls}>
  <span>${() => count()}</span>
  <button on:click=${handler}>Click</button>
</div>`;

// After compilation (production build):
const el = ((v) => div({
  class: v[0],
  nodes: [
    span({ nodes: v[1] }),
    button({ on: { click: v[2] }, nodes: "Click" })
  ]
}))([cls, () => count(), handler]);
```

The compiler handles all template features: static/dynamic attributes, event handlers (`on:click`), expression children, nested elements, self-closing/void elements, and SVG.

**Plugin options:**

```ts
sibuVitePlugin({
  compileTemplates: true,   // Compile html`` to direct calls (default: true in prod, false in dev)
  staticOptimize: true,     // Convert fully-static tag calls to template cloning (default: true in prod)
  pureAnnotations: true,    // Add /*#__PURE__*/ for tree-shaking (default: true)
  hmr: true,                // HMR support for Sibu components (default: true)
  devMode: false,           // Dev helpers: __SIBU_DEV__ flag, debug logging (default: auto from NODE_ENV)
})
```

**Without a build step:** The runtime `html` parser still works. Templates are parsed once per call site and cached via `WeakMap` — subsequent renders at the same source location skip parsing entirely. The ~1.5x overhead only applies to the very first render of each component.

**Recommendation:** Use whichever style reads best for your team. If you use Vite (or any build step), the `html` style has zero performance penalty. Without a build step, the overhead is only on first render per component and is negligible for most applications.

---

## Why Sibu Instead of React, Vue, Svelte, or Solid

Every mainstream framework makes a set of tradeoffs. Sibu makes different ones.

### vs. React

React uses a virtual DOM. Every state change re-executes the entire component function, diffs a virtual tree against the previous one, and patches the real DOM. This is conceptually simple but inherently wasteful -- most of the tree hasn't changed.

Sibu has no virtual DOM. When `setCount` is called, only the text node displaying `count()` updates. The `div`, the `h1`, the `button` -- none of them are re-evaluated or diffed. They were created once and they persist. This is not an optimization layered on top; it is the fundamental architecture.

React also requires JSX, which requires a compiler. Sibu runs as plain TypeScript or JavaScript. No Babel plugin. No compiler transform. The code you write is the code that runs.

|                        | React                           | Sibu                     |
| ---------------------- | ------------------------------- | ------------------------ |
| Rendering model        | Virtual DOM diffing             | Direct DOM, signal-based |
| Compilation            | Required (JSX)                  | None                     |
| Component re-execution | Entire function on every render | Never -- created once    |
| Granularity of updates | Component-level                 | Node-level               |
| Bundle overhead        | ~45 KB min (react + react-dom)  | Core only                |

### vs. Vue

Vue's template compiler generates optimized render functions behind the scenes. Its reactivity system (Proxy-based in Vue 3) is powerful but requires understanding refs, reactive objects, `computed`, `watch`, `toRefs`, `unref`, and the distinction between `.value` access and template auto-unwrapping.

Sibu's reactivity is simpler. There is one primitive: `signal` returns `[getter, setter]`. You call the getter to read, the setter to write. Dependencies are tracked automatically. There is no `.value`, no `ref()` vs `reactive()`, no unwrapping rules.

Vue templates are a separate language with their own directives (`v-if`, `v-for`, `v-bind`, `v-model`, `v-slot`). In Sibu, all of these are plain functions (`when`, `each`, reactive props, slots-as-functions).

|                        | Vue                                           | Sibu                            |
| ---------------------- | --------------------------------------------- | ------------------------------- |
| Template language      | Custom (SFCs, directives)                     | HTML tagged templates (runtime) |
| Reactivity API surface | ref, reactive, computed, watch, toRefs, unref | signal, derived, watch          |
| Build requirement      | Vite/Vue CLI for SFCs                         | None                            |
| Learning curve         | Moderate (Options + Composition API)          | Minimal (functions + signals)   |

### vs. Svelte

Svelte shifts work to compile time: it analyzes `.svelte` files and generates imperative DOM operations. The result is fast and small, but you must use the Svelte compiler, Svelte's file format, and Svelte's reactivity syntax (`$:`, `$state`, etc.).

Sibu achieves similar fine-grained DOM updates at runtime, without a compiler. The tradeoff is that Svelte can optimize away more framework code at build time. The benefit is that Sibu is just TypeScript -- your existing tooling, type checking, and editor support work without any Svelte-specific plugins.

|                        | Svelte                        | Sibu                   |
| ---------------------- | ----------------------------- | ---------------------- |
| Compilation            | Required (.svelte files)      | None                   |
| File format            | Custom (.svelte)              | Standard .ts / .js     |
| Reactivity             | Compiler-analyzed ($:, runes) | Runtime signals        |
| Editor support         | Requires Svelte plugin        | Standard TypeScript    |
| DOM update granularity | Fine-grained (compiled)       | Fine-grained (runtime) |

### vs. Solid

Solid is the closest comparison. Both use fine-grained reactivity with signals. Both skip the virtual DOM. Both update at the node level.

The key differences:

1. **No compiler.** Solid strongly recommends JSX with its Babel plugin for optimal performance. Sibu's `html` tagged template gives you familiar HTML syntax without any build step.
2. **API style.** Solid uses `createSignal`, `createEffect`, `createMemo` and JSX. Sibu uses `signal`, `effect`, `derived` and `html` templates. If you prefer a runtime-only approach with zero tooling, Sibu is a more natural fit.
3. **Architecture.** Sibu provides a disposal system (`dispose`/`registerDisposer`), an explicit `mount`/`unmount` lifecycle, and a modular package split (core / extras / plugins / build). Solid bundles more into its core and relies on its compiler for tree shaking.

|                       | Solid                       | Sibu                               |
| --------------------- | --------------------------- | ---------------------------------- |
| Recommended authoring | JSX (compiled)              | `html` tagged template (runtime) |
| Signal API            | createSignal / createEffect | signal / effect                    |
| Disposal model        | Owner tree (automatic)      | Explicit dispose + WeakMap         |
| Package structure     | Monolithic core             | Modular (core / extras / plugins)  |

### The Core Principle

Most frameworks ask you to describe the UI and then figure out how to update the DOM efficiently. Sibu asks you to build the DOM directly and tell it which parts are reactive. The result is code that is predictable, inspectable, and close to the metal.

---

## Architecture

### Reactivity

The reactivity system is three functions: `track`, `recordDependency`, and `notifySubscribers`.

When a signal's getter is called, `recordDependency` links the signal to the current subscriber. When a signal's setter is called, `notifySubscribers` calls every subscriber. `track` runs a function while setting up the subscriber context. That is the entire reactivity engine.

```
signal(0)
  |
  +--> getter: calls recordDependency(signal)
  |        |
  |        +--> links signal <-> current subscriber (set by track)
  |
  +--> setter: calls notifySubscribers(signal)
           |
           +--> runs every subscriber linked to signal
```

Dependencies are tracked via `WeakMap<Signal, Set<Subscriber>>`, so unused signals and subscribers are garbage collected automatically.

### The `html` Tagged Template

The `html` function is a runtime tagged template literal that parses HTML-like syntax and creates DOM elements via Sibu's tag factories. No compiler, no build step -- just a function call.

```ts
import { html, signal } from "sibujs";

html`<div id="app" class="container">
  <h1>${() => `Hello, ${name()}`}</h1>
  <button on:click=${handler}>Click me</button>
  <input type="text" value=${() => text()} />
</div>`;
```

**Supported features:**

- All HTML and SVG tags
- Static attributes: `class="foo"`
- Dynamic attributes: `class=${() => "active"}`, `id=${myId}`
- Event handlers: `on:click=${handler}`, `on:input=${handler}`
- Reactive text children: `${() => count()}`
- Element children: `${MyComponent()}`, `${each(...)}`, `${when(...)}`
- Self-closing tags: `<br />`, `<img src="..." />`
- Void elements: `<br>`, `<input>`, `<hr>`

### Reactive Props (full props API)

When using the tag factory API directly, every prop can be reactive:

```ts
import { div } from "sibujs";

div({
  // Static class
  class: "card",

  // Reactive class (string)
  class: () => isActive() ? "card active" : "card",

  // Conditional class (object)
  class: { card: true, active: isActive, bold: () => isBold() },

  // Static style
  style: { color: "red", fontSize: "14px" },

  // Reactive style (per-property)
  style: { color: () => theme().primary },

  // Reactive nodes
  nodes: () => `Count: ${count()}`,

  // Events
  on: { click: handleClick, mouseover: handleHover },

  // Ref (reactive — works with resize(), draggable(), etc.)
  ref: myRef,

  // onElement callback — called after element creation
  onElement: (el) => inputMask.bind(el),

  // Any other attribute (empty strings set boolean attributes)
  "data-testid": "my-card",
  disabled: () => isDisabled(),
});
```

### Disposal

Reactive bindings (class, style, attribute, node) register teardown functions on their DOM nodes via `registerDisposer`. When you call `dispose(node)`, it walks the subtree depth-first and tears down every binding, preventing memory leaks.

`mount()` returns an `unmount` function that calls `dispose` and removes the node:

```ts
const { node, unmount } = mount(App, document.getElementById("root"));

// Later:
unmount(); // disposes all reactive bindings + removes from DOM
```

---

## Core API

### State and Reactivity

```ts
import { signal, effect, derived, watch, batch } from "sibujs";

// Reactive state
const [count, setCount] = signal(0);
count();           // read (tracks dependency)
setCount(5);       // write (notifies subscribers)
setCount(c => c + 1); // updater function

// Derived state
const doubled = derived(() => count() * 2);
doubled(); // always 2x count, auto-updates

// Side effects
const cleanup = effect(() => {
  console.log("count changed:", count());
});
cleanup(); // stop watching

// Watch with old/new values
const stop = watch(count, (newVal, oldVal) => {
  console.log(`${oldVal} -> ${newVal}`);
});

// Batch multiple updates into one notification
batch(() => {
  setCount(10);
  setName("Alice");
}); // subscribers notified once
```

### Additional Signals & Utilities

```ts
import { ref, memo, memoFn, array, deepSignal, store } from "sibujs";

// Reactive ref — reading .current tracks, writing .current notifies
// Works with browser APIs like resize(), draggable(), dropZone()
const elRef = ref<HTMLElement>();
elRef.current; // read (tracks dependency)
elRef.current = myElement; // write (notifies subscribers)

// Memoized value (alias for derived)
const expensive = memo(() => heavyComputation(data()));

// Memoized callback
const handler = memoFn(() => (e: Event) => process(e, count()));

// Reactive array with mutation methods
const [items, actions] = array<string>(["a", "b"]);
actions.push("c");
actions.removeWhere(item => item === "a");
actions.sort((a, b) => a.localeCompare(b));

// Deep equality state (objects/arrays)
const [config, setConfig] = deepSignal({ theme: "dark", lang: "en" });

// Shared store with actions
const [store, { setState, reset, subscribe }] = store({ count: 0, name: "" });
```

### Rendering

```ts
import { html, mount, each, when, match, show, Fragment, Portal, signal } from "sibujs";

// Mount with unmount support
const { unmount } = mount(App, document.getElementById("root"));

// Keyed list rendering with LIS-based diffing
html`<ul>
  ${each(
    () => items(),
    (item, i) => html`<li>${item.name}</li>`,
    { key: item => item.id }
  )}
</ul>`;

// Conditional rendering (swaps DOM nodes)
html`<div>
  ${when(
    () => isLoggedIn(),
    () => Dashboard(),
    () => LoginForm()
  )}
</div>`;

// Toggle visibility (keeps node, toggles display)
show(() => isVisible(), myElement);

// Pattern matching
html`<div>
  ${match(
    () => status(),
    {
      loading: () => Spinner(),
      error: () => ErrorView(),
      success: () => Content(),
    },
    () => html`<div>Unknown</div>`
  )}
</div>`;

// Fragment (no wrapper element)
Fragment([child1, child2, child3]);

// Portal (render into a different container)
Portal(() => Modal(), document.getElementById("modal-root"));
```

### Dynamic Components

```ts
import { html, DynamicComponent, registerComponent, signal } from "sibujs";

// Register components by name
registerComponent("greeting", () => html`<div>Hello!</div>`);
registerComponent("farewell", () => html`<div>Goodbye!</div>`);

// Reactively switch between components
const [view, setView] = signal("greeting");
DynamicComponent(() => view()); // renders "greeting" component
setView("farewell");            // swaps to "farewell" component

// Or pass a component function directly
DynamicComponent(() => view() === "admin" ? AdminPanel : UserPanel);
```

### Error Handling

```ts
import { catchError, catchErrorAsync, setGlobalErrorHandler } from "sibujs";

// Wrap sync functions
const result = catchError(
  () => JSON.parse(input),
  (err, context) => console.error(`${context} error:`, err),
);

// Wrap async functions
const data = await catchErrorAsync(
  () => fetch("/api/data").then(r => r.json()),
  (err) => showError(err),
);

// Global fallback handler
setGlobalErrorHandler((err, context) => {
  reportToSentry(err);
});
```

### Loading Component

```ts
import { Loading } from "sibujs";

Loading();                                    // default spinner
Loading({ text: "Loading..." });              // with text
Loading({ variant: "dots" });                 // dots animation
Loading({ size: "lg", text: "Please wait" }); // large with text
```

### Dynamic Attribute Binding

```ts
import { html, bindDynamic, signal } from "sibujs";

const el = html`<div>Hover me</div>` as HTMLElement;

// Both attribute name and value can be reactive
const [attr, setAttr] = signal("title");
const [value, setValue] = signal("Tooltip text");
const teardown = bindDynamic(el, () => attr(), () => value());

setAttr("aria-label"); // old "title" removed, new "aria-label" set
teardown();            // stops tracking and removes the attribute
```

### Lazy Loading and Suspense

```ts
import { html, lazy, Suspense } from "sibujs";

const LazyDashboard = lazy(() => import("./Dashboard"));

Suspense({
  nodes: () => LazyDashboard(),
  fallback: () => html`<div>Loading...</div>`,
});
```

### Components and Composition

```ts
import { html, getSlot, context, ErrorBoundary } from "sibujs";
import type { Slots } from "sibujs";

// Slots (named functions)
function Card({ slots }: { slots?: Slots }) {
  return html`<div class="card">
    <div class="card-header">${getSlot(slots, "header")?.() ?? ""}</div>
    <div class="card-body">${getSlot(slots, "default")?.() ?? ""}</div>
  </div>`;
}

Card({
  slots: {
    header: () => html`<h2>Title</h2>`,
    default: () => html`<p>Body content</p>`,
  },
});

// Context (dependency injection)
const ThemeCtx = context("light");
ThemeCtx.provide("dark");
const theme = ThemeCtx.use(); // "dark"

// Error boundaries
ErrorBoundary({
  nodes: RiskyComponent(),
  fallback: (err, retry) => html`<div>
    <p>Error: ${err.message}</p>
    <button on:click=${retry}>Retry</button>
  </div>`,
});
```

### Lifecycle

```ts
import { html, onMount, onUnmount, dispose } from "sibujs";

function MyComponent() {
  const el = html`<div>Hello</div>`;

  onMount(() => {
    console.log("mounted");
    return () => console.log("cleanup on unmount");
  }, el);

  onUnmount(() => console.log("removed"), el);

  return el;
}

// Manual disposal of reactive bindings
dispose(someElement); // tears down element + all descendants
```

---

## Plugins (`sibu/plugins`)

### Router

Full client-side router with history/hash modes, guards, nested routes, lazy loading, transitions, and SSR support.

```ts
import { html, mount } from "sibujs";
import { createRouter, setRoutes, navigate, Route, RouterLink, lazy } from "sibujs/plugins";

// Define routes
setRoutes([
  { path: "/", component: Home },
  { path: "/about", component: About },
  {
    path: "/dashboard",
    component: Dashboard,
    guard: () => isLoggedIn(),
    redirectTo: "/login",
    children: [
      { path: "settings", component: Settings },
    ],
  },
  {
    path: "/admin",
    component: lazy(() => import("./Admin")), // code splitting
  },
]);

// Navigate programmatically
await navigate("/about");
await navigate({ name: "user", params: { id: "42" } });

// Components
function App() {
  return html`<div>
    <nav>
      ${RouterLink({ to: "/", nodes: "Home" })}
      ${RouterLink({ to: "/about", nodes: "About" })}
    </nav>
    ${Route()}
  </div>`;
}

// Guards
beforeEach(async (to, from) => {
  if (to.path === "/admin" && !isAdmin()) return "/login";
  return true;
});
```

### Internationalization (i18n)

Reactive translations with parameter interpolation.

```ts
import { setLocale, registerTranslations, t, Trans } from "sibujs/plugins";

registerTranslations("en", {
  greeting: "Hello, {name}!",
  items: "You have {count} items",
});

registerTranslations("es", {
  greeting: "Hola, {name}!",
  items: "Tienes {count} elementos",
});

setLocale("en");

// Imperative
t("greeting", { name: "Mark" }); // "Hello, Mark!"

// Reactive component (auto-updates on locale change)
Trans("greeting", { name: "Mark" });
```

---

## Patterns (`sibujs/patterns`)

Advanced state management patterns, imported separately to keep the core lean.

### State Machines

```ts
import { machine } from "sibujs/patterns";

const { state, send, matches, can } = machine({
  initial: "idle",
  context: { retries: 0 },
  states: {
    idle: {
      on: { FETCH: "loading" },
    },
    loading: {
      on: {
        SUCCESS: "success",
        FAILURE: { target: "error", action: (ctx) => ({ ...ctx, retries: ctx.retries + 1 }) },
      },
    },
    success: { on: { RESET: "idle" } },
    error: {
      on: {
        RETRY: { target: "loading", guard: (ctx) => ctx.retries < 3 },
      },
    },
  },
});

send("FETCH");
matches("loading"); // true
can("RETRY");       // false (not in error state)
```

### Form Validation

```ts
import { form, required, email, minLength } from "sibujs/ui";

const myForm = form({
  username: { initial: "", validators: [required(), minLength(3)] },
  email: { initial: "", validators: [required(), email()] },
});

// Reactive getters
myForm.fields.username.value();
myForm.fields.username.error();
myForm.isValid();
myForm.isDirty();

// Handle submission (pass callback to handleSubmit)
const onSubmit = myForm.handleSubmit((values) => api.register(values));
// Attach to form: on: { submit: onSubmit }
```

### Global Store

```ts
import { globalStore } from "sibujs/patterns";

const store = globalStore({
  state: { count: 0, user: null },
  actions: {
    increment: (state) => ({ ...state, count: state.count + 1 }),
    setUser: (state, user) => ({ ...state, user }),
  },
  middleware: [(state, action, payload, next) => { console.log(action, state); next(); }],
});

store.dispatch("increment");
const count = store.select((s) => s.count); // reactive selector
count(); // 1
```

### Persistent State

```ts
import { persisted } from "sibujs/patterns";

// Auto-saves to localStorage, restores on page load
const [theme, setTheme] = persisted("app-theme", "light");
setTheme("dark"); // saved to localStorage automatically
```

### Time Travel

```ts
import { timeline } from "sibujs/patterns";

const { value, set, undo, redo, canUndo, canRedo } = timeline("initial");
set("second");
set("third");
undo(); // value() === "second"
redo(); // value() === "third"
```

### Optimistic Updates

```ts
import { optimistic } from "sibujs/patterns";

const [likes, addLike] = optimistic(0);
addLike(likes() + 1, async () => {
  return await api.like(postId); // reverts if this throws
});
```

## Data Fetching (`sibujs/data`)

```ts
import { query, mutation, infiniteQuery, resource } from "sibujs/data";

// Query with caching, stale-while-revalidate, and auto-refetch
const { data, loading, error, refetch } = query("users", async ({ signal }) => {
  const res = await fetch("/api/users", { signal });
  return res.json();
}, {
  staleTime: 30_000,
  refetchOnWindowFocus: true,
});

// Cache management
import { invalidateQueries, setQueryData } from "sibujs/data";
invalidateQueries("users");
setQueryData("users", (prev) => [...prev, newUser]);

// Mutations with optimistic updates
const { mutate, mutateAsync, loading: saving } = mutation(
  (user) => fetch("/api/users", { method: "POST", body: JSON.stringify(user) }),
  {
    onMutate: (variables) => {
      const prev = getQueryData("users");
      setQueryData("users", (old) => [...old, variables]);
      return prev; // context for rollback
    },
    onError: (_err, _vars, context) => setQueryData("users", context),
    onSuccess: () => invalidateQueries("users"),
  }
);

// Infinite / paginated queries
const { pages, fetchNextPage, hasNextPage } = infiniteQuery(
  "feed",
  ({ pageParam }) => fetch(`/api/feed?page=${pageParam}`).then(r => r.json()),
  { getNextPageParam: (lastPage) => lastPage.nextCursor }
);

// Low-level resource (Solid-style)
const resource = resource(
  () => userId(),
  (id, { signal }) => fetch(`/api/users/${id}`, { signal }).then(r => r.json())
);
resource.data(); // reactive
```

### Debounce, Throttle, and Previous

```ts
import { debounce, throttle, previous } from "sibujs/data";

// Debounced reactive value (updates after 300ms of inactivity)
const debouncedSearch = debounce(() => searchInput(), 300);

// Throttled reactive value (updates at most once per 100ms)
const throttledScroll = throttle(() => scrollY(), 100);

// Track previous value
const prevCount = previous(count);
// prevCount() is the value before the last change
```

## Browser APIs (`sibujs/browser`)

All browser APIs return reactive getters and a `dispose` function for cleanup.

```ts
import {
  media,
  online,
  clipboard,
  title,
  colorScheme,
  draggable,
  dropZone,
  resize,
  scroll,
  geo,
  battery,
  idle,
  permissions,
} from "sibujs/browser";

// Media queries
const { matches: isMobile } = media("(max-width: 768px)");

// Online/offline status
const { online } = online();

// Clipboard
const { text, copy, copied } = clipboard();
await copy("Hello!");
copied(); // true (resets after 2s)

// Reactive document title
const disposeTitle = title(() => `(${unread()}) My App`);

// Dark/light mode preference
const { scheme } = colorScheme();
scheme(); // "dark" | "light"

// Drag and drop — accepts ref or getter
const dragRef = ref<HTMLElement>();
const { isDragging } = draggable(dragRef, { type: "card", id: 1 });
const { isOver } = dropZone(dragRef, {
  onDrop: (data, event) => handleDrop(data),
});

// Resize observer — accepts ref or getter
const elRef = ref<HTMLElement>();
const { width, height } = resize(elRef);

// Scroll position
const { scrollX, scrollY } = scroll();

// Geolocation
const { latitude, longitude, error } = geo();

// Battery status
const { level, charging } = battery();

// Idle detection
const { idle } = idle(60_000); // idle after 60s

// Permission status
const { state: cameraPermission } = permissions("camera");
```

### Real-Time Communication

```ts
import { socket, stream } from "sibujs/data";
import { eventBus } from "sibujs/ui";

// WebSocket with auto-reconnect and heartbeat
const { data, status, send, close } = socket("wss://api.example.com/ws", {
  autoReconnect: true,
  reconnectDelay: 1000,
  maxReconnects: 5,
  heartbeat: { interval: 30_000, message: "ping" },
});
send("hello");
status(); // "connecting" | "open" | "closing" | "closed"

// Server-Sent Events (SSE)
const { data: sseData, event, status: sseStatus } = stream("/api/events", {
  withCredentials: true,
});

// Typed event bus
const bus = eventBus<{ notify: string; update: { id: number } }>();
const off = bus.on("notify", (msg) => console.log(msg));
bus.emit("notify", "Hello!");
off(); // unsubscribe
```

## UI Utilities (`sibujs/ui`)

### Virtual List

```ts
import { html, signal } from "sibujs";
import { VirtualList } from "sibujs/ui";

VirtualList({
  items: () => largeArray(),
  itemHeight: 40,
  containerHeight: 400,
  overscan: 5,
  renderItem: (item, index) => html`<div>${item.name}</div>`,
});
```

## Transitions and Animations (`sibujs/motion`)

```ts
import { transition, TransitionGroup, viewTransition } from "sibujs/motion";

// Single element transition
const { enter, leave } = transition(element, {
  property: "opacity",
  duration: 300,
  easing: "ease-in-out",
});
await enter();  // fade in
await leave();  // fade out

// Group transitions with FLIP animations
const group = TransitionGroup({
  enter: (el) => el.animate([{ opacity: 0 }, { opacity: 1 }], 300).finished,
  leave: (el) => el.animate([{ opacity: 1 }, { opacity: 0 }], 300).finished,
});
group.add(newElement);
await group.remove(oldElement);

// View Transitions API (with fallback)
const { start, isTransitioning } = viewTransition(() => {
  setPage("next");
});
await start();
```

### Dialogs and Toasts

```ts
import { dialog, toast } from "sibujs/ui";

// Dialog state
const dialog = dialog();
dialog.open();
dialog.isOpen(); // true
dialog.close();  // also closes on Escape

// Toast notifications
const { toasts, show, dismiss, dismissAll } = toast({
  duration: 5000,
  maxToasts: 3,
});
const id = show("Saved successfully!", "success");
dismiss(id);
```

### Pagination and Infinite Scroll

```ts
import { pagination, infiniteScroll } from "sibujs/ui";

// Pagination
const { page, totalPages, next, prev, goTo, startIndex, endIndex } = pagination({
  totalItems: () => items().length,
  pageSize: 20,
});

// Infinite scroll with IntersectionObserver
const { sentinelRef, loading } = infiniteScroll({
  onLoadMore: () => fetchNextPage(),
  hasMore: () => hasNextPage(),
  threshold: 0.5,
});
```

### Intersection Observer and Lazy Loading

```ts
import { intersection, lazyLoad } from "sibujs/ui";

// Track element visibility
const { isIntersecting, intersectionRatio, observe } = intersection({
  threshold: 0.5,
});
observe(myElement);

// Lazy-load content when visible
const cleanup = lazyLoad(placeholder, () => {
  placeholder.replaceWith(HeavyComponent());
});
```

### Input Masks

```ts
import { inputMask, phoneMask, dateMask, creditCardMask } from "sibujs/ui";

const phone = inputMask(phoneMask());     // (999) 999-9999
const date = inputMask(dateMask());       // 99/99/9999
const card = inputMask(creditCardMask()); // 9999 9999 9999 9999

phone.bind(inputElement);
phone.value();    // formatted: "(555) 123-4567"
phone.rawValue(); // unformatted: "5551234567"
```

### Accessibility

```ts
import { html } from "sibujs";
import { aria, FocusTrap, hotkey, announce } from "sibujs/ui";

// Reactive ARIA attributes
aria(element, {
  expanded: () => isOpen(),
  label: "Navigation menu",
});

// Focus trapping (modals, dialogs)
FocusTrap(modalContent, { autoFocus: true, restoreFocus: true });

// Keyboard shortcuts
const cleanup = hotkey("s", (e) => save(), { ctrl: true });

// Screen reader announcements
announce("Item deleted", "polite");
```

### Scoped Styles

```ts
import { html } from "sibujs";
import { scopedStyle, withScopedStyle } from "sibujs/ui";

// Manual scoping
const { scope, attr } = scopedStyle(`
  .card { border: 1px solid #ccc; padding: 16px; }
  .card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
`);

// Auto-scoped component
const StyledCard = withScopedStyle(`
  .card { background: white; border-radius: 8px; }
`, (props) => html`<div class="card">${props.content}</div>`);
```

### Higher-Order Components

```ts
import { withDefaults, withWrapper, compose } from "sibujs/patterns";

const Button = withDefaults(BaseButton, { variant: "primary", size: "md" });

const LoggedButton = withWrapper(BaseButton, (Component, props) => {
  console.log("rendering button", props);
  return Component(props);
});

const EnhancedButton = compose(withLogging, withTheme, withTooltip)(BaseButton);
```

### Composables

```ts
import { html, signal } from "sibujs";
import { composable } from "sibujs/ui";

const counterSetup = composable(() => {
  const [count, setCount] = signal(0);
  return { count, increment: () => setCount(c => c + 1) };
});

// Reuse in any component
function MyComponent() {
  const { count, increment } = counterSetup();
  return html`<button on:click=${increment}>${() => count()}</button>`;
}
```

---

## Widgets (`sibujs/widgets`)

Headless UI primitives -- state logic and keyboard navigation without opinions on markup. Build your own UI on top.

### Tabs

```ts
import { tabs } from "sibujs/widgets";

const tabs = tabs({
  tabs: [
    { id: "general", label: "General" },
    { id: "security", label: "Security" },
    { id: "billing", label: "Billing", disabled: true },
  ],
  defaultTab: "general",
});

tabs.activeTab();      // "general"
tabs.setActiveTab("security");
tabs.nextTab();        // keyboard arrow navigation
tabs.prevTab();
tabs.isActive("general"); // reactive check — safe inside each()
```

### Select

```ts
import { select } from "sibujs/widgets";

const select = select({
  items: ["Apple", "Banana", "Cherry"],
  multiple: false,
});

select.open();
select.highlightNext();
select.selectHighlighted();
select.selectedItem();     // "Apple"
select.isSelected("Apple"); // true
```

### Accordion

```ts
import { accordion } from "sibujs/widgets";

const accordion = accordion({
  items: [
    { id: "faq-1", label: "What is Sibu?" },
    { id: "faq-2", label: "How does reactivity work?" },
  ],
  multiple: false,
});

accordion.toggle("faq-1");
accordion.items(); // [{ id: "faq-1", label: "...", isExpanded: true }, ...]
accordion.isExpanded("faq-1"); // reactive check — safe inside each()
accordion.expandAll();
accordion.collapseAll();
```

### Combobox

```ts
import { combobox } from "sibujs/widgets";

const combo = combobox({
  items: ["New York", "Los Angeles", "Chicago", "Houston"],
  filterFn: (item, query) => item.toLowerCase().includes(query.toLowerCase()),
});

combo.setQuery("chi");
combo.filteredItems();       // ["Chicago"]
combo.selectHighlighted();
combo.selectedItem();        // "Chicago"
```

### Popover and Tooltip

```ts
import { popover, tooltip } from "sibujs/widgets";

const popover = popover();
popover.toggle();
popover.isOpen(); // true

const tooltip = tooltip({ delay: 200 });
tooltip.setContent("More info");
tooltip.show();
tooltip.isVisible(); // true (after 200ms delay)
```

### File Upload

```ts
import { fileUpload } from "sibujs/widgets";

const upload = fileUpload({
  accept: "image/*",
  multiple: true,
  maxSize: 5 * 1024 * 1024, // 5 MB
  onFiles: (files) => console.log("Selected:", files),
});

upload.files();      // reactive list of File objects
upload.errors();     // validation errors (e.g., "File exceeds max size")
upload.isDragOver(); // true when dragging over drop zone
upload.clear();
```

### Date Picker

```ts
import { datePicker } from "sibujs/widgets";

const picker = datePicker({
  minDate: new Date(2020, 0, 1),
  maxDate: new Date(2030, 11, 31),
});

picker.nextMonth();
picker.daysInMonth(); // [{ date, isCurrentMonth, isToday, isSelected, isDisabled }, ...]
picker.select(new Date(2025, 5, 15));
picker.selectedDate(); // Date
picker.isSelected(someDate); // reactive check — safe inside each()
```

### Content Editable

```ts
import { contentEditable } from "sibujs/widgets";

const editor = contentEditable();
editor.setContent("<b>Hello</b> world");
editor.bold();      // execCommand("bold")
editor.italic();
editor.underline();
editor.content();   // reactive HTML string
```

---

## Web Components (`sibujs/ui`)

```ts
import { html, signal } from "sibujs";
import { defineElement } from "sibujs/ui";

defineElement("my-counter", (props) => {
  const [count, setCount] = signal(Number(props.initial) || 0);
  return html`<button on:click=${() => setCount(c => c + 1)}>${() => count()}</button>`;
}, {
  shadow: true,
  observedAttributes: ["initial"],
});
```

```html
<my-counter initial="5"></my-counter>
```

---

## SSR and Static Generation (`sibujs/ssr`)

### Server-Side Rendering

```ts
import {
  renderToString,
  renderToStream,
  renderToDocument,
  hydrate,
} from "sibujs/ssr";

// Render component to HTML string
const markup = renderToString(App());

// Full document with head management
const page = renderToDocument(App, {
  title: "My App",
  meta: [{ name: "description", content: "A Sibu app" }],
  scripts: ["/app.js"],
});

// Streaming SSR
const stream = renderToStream(App());
for await (const chunk of stream) {
  res.write(chunk);
}

// Client-side hydration
hydrate(App, document.getElementById("root"));
```

### Islands Architecture

```ts
import { island, hydrateIslands, hydrateProgressively } from "sibujs/ssr";

// Server: mark interactive islands
const header = island("header", () => InteractiveHeader());

// Client: hydrate only interactive parts
hydrateIslands(document.body, {
  header: () => InteractiveHeader(),
  sidebar: () => InteractiveSidebar(),
});

// Progressive hydration (hydrates when scrolled into view)
hydrateProgressively(document.body, islands, { threshold: 0.1 });
```

### Suspense SSR

```ts
import { html } from "sibujs";
import { ssrSuspense, renderToSuspenseStream, suspenseSwapScript } from "sibujs/ssr";

const boundary = ssrSuspense({
  fallback: () => html`<div>Loading...</div>`,
  content: () => fetchAndRender(),
});

// Stream HTML with out-of-order suspense resolution
const stream = renderToSuspenseStream(shell, [boundary.promise]);
```

### Static Site Generation

```ts
import { generateStaticSite } from "sibujs/ssr";

const result = await generateStaticSite({
  routes: ["/", "/about", "/blog/1", "/blog/2"],
  renderFn: async (path) => renderToDocument(App, { title: path }),
  outDir: "./dist",
});

result.pages;  // [{ path: "/", html: "..." }, ...]
result.errors; // [{ path: "/blog/2", error: Error }]
```

---

## Concurrent Rendering (`sibujs/performance`)

```ts
import {
  startTransition,
  deferredValue,
  transitionState,
  uniqueId,
  scheduleUpdate,
  yieldToMain,
  processInChunks,
  Priority,
} from "sibujs/performance";

// Non-blocking state updates
startTransition(() => {
  setSearchResults(filterLargeList(query()));
});

// Deferred value (updates at lower priority)
const deferredQuery = deferredValue(() => query());

// Transition with pending state
const [isPending, startTransition] = transitionState();

// Unique IDs (SSR-safe)
const myId = uniqueId();       // "sibu-0"
const labelId = uniqueId("label"); // "sibu-1-label"

// Priority-based scheduling
scheduleUpdate(Priority.USER_BLOCKING, () => updateUI());
scheduleUpdate(Priority.IDLE, () => prefetchData());

// Yield to main thread
await yieldToMain();

// Process large arrays without blocking
await processInChunks(bigArray, (item) => processItem(item), 50);
```

---

## DevTools (`sibujs/devtools`)

### Debugging and Performance

```ts
import {
  enableDebug,
  debugLog,
  perfTracker,
  measureRender,
  getPerformanceReport,
  checkLeaks,
} from "sibujs/devtools";

enableDebug();
debugLog("Counter", "increment", { value: 5 });

// Measure component render times
const MeasuredList = measureRender("ItemList", ItemList);

// Manual performance tracking
const perf = perfTracker("search");
perf.startMeasure();
// ... expensive operation
perf.endMeasure();
perf.getAverageTime();

// Get full report
getPerformanceReport();
// { "search": { count: 10, average: 4.2, min: 2, max: 8, total: 42 } }

// Check for cleanup leaks
checkLeaks(); // { "Counter": 2 } -- 2 unclean instances
```

### DevTools Integration

```ts
import { initDevTools, devState, getActiveDevTools } from "sibujs/devtools";

const devtools = initDevTools({ maxEvents: 1000 });

// State with automatic change tracking
const [count, setCount] = devState("counter", 0);
// Changes are recorded: { type: "state-change", component: "counter", ... }

// Register components
devtools.registerComponent("App", rootElement, { count: 0 });

// Query events
devtools.getEvents({ type: "state-change", component: "counter" });

// Snapshot all registered state
devtools.snapshot();
```

### Hot Module Replacement

```ts
import { hmrState, registerHMR, createHMRBoundary } from "sibujs/devtools";

// State that persists across HMR updates
const [count, setCount] = hmrState("counter", 0);

// Register component for hot replacement
const { update, dispose } = registerHMR("App", App, container);

// HMR boundary
const boundary = createHMRBoundary("feature");
const wrapped = boundary.wrap(() => FeatureComponent());
boundary.accept(() => console.log("Module updated"));
```

---

## Ecosystem Adapters (`sibujs/ecosystem`)

### State Management

```ts
import { reduxAdapter, zustandAdapter, mobXAdapter } from "sibujs/ecosystem";

// Use Redux store with Sibu reactivity
const { useSelector, dispatch } = reduxAdapter(reduxStore);
const count = useSelector((s) => s.counter.value);

// Use Zustand store
const { store } = zustandAdapter(zustandStore);

// Use MobX observables
const { useObservable } = mobXAdapter();
```

### UI Framework Integration

```ts
import { componentAdapter, createTheme } from "sibujs/ecosystem";

const adapter = componentAdapter();
const theme = createTheme({ colors: { primary: "#007bff" } });
```

---

## Build (`sibujs/build`)

Bundler plugins and deployment utilities.

```ts
// Vite
import { sibuVitePlugin } from "sibujs/build";
export default { plugins: [sibuVitePlugin()] };

// Webpack
import { sibuWebpackPlugin } from "sibujs/build";
module.exports = { plugins: [sibuWebpackPlugin()] };
```

Additional build utilities: CDN deployment, type declaration generation, bundle analyzer, linting rules, IDE support, and static analysis tools.

---

## Testing (`sibujs/testing`)

Component testing utilities, accessibility testing, E2E helpers, snapshot testing, and visual regression support. Works with Vitest, Jest, and Playwright.

```ts
import { render, fireEvent, waitFor } from "sibujs/testing";

const { container, unmount } = render(Counter);
fireEvent.click(container.querySelector("button"));
expect(container.textContent).toContain("Count: 1");
unmount();
```

---

## Package Structure

Sibu is split into modular entry points. Import only what you use.

```
sibujs                Core: signal, effect, derived, mount, each, when, html, tags, ErrorBoundary
sibujs/plugins        Router, i18n
sibujs/data           Data fetching: query, mutation, infiniteQuery, socket, stream
sibujs/browser        Browser APIs: media, geo, resize, scroll, online, battery, ...
sibujs/patterns       State patterns: machine, persisted, timeline, optimistic, globalStore
sibujs/motion         Transitions: transition, TransitionGroup, viewTransition, reducedMotion
sibujs/ui             Forms, a11y, dialogs, toasts, virtual lists, composables, web components
sibujs/widgets        Headless UI: tabs, select, accordion, combobox, popover, datePicker, ...
sibujs/ssr            SSR, hydration, islands, static site generation
sibujs/performance    Concurrent rendering, scheduling, DOM recycling, chunk loading
sibujs/devtools       Debugging, profiling, HMR, component introspection
sibujs/ecosystem      Adapters: Redux, MobX, Zustand, Material UI, Chakra, Ant Design
sibujs/build          Vite plugin, Webpack plugin, template compiler, CDN utilities
sibujs/testing        Component testing utilities
```

The core has zero dependencies beyond TypeScript. Tree shaking works at the module level -- unused subpaths are not included in your bundle.

---

## Development

```bash
# Install
npm install

# Run tests
npm test

# Type check
npx tsc --noEmit

# Build
npm run build
```

---

## Contributing

Contributions are welcome! Please read our
[Contributing Guide](.github/CONTRIBUTING.md) and
[Code of Conduct](.github/CODE_OF_CONDUCT.md)
before submitting a PR.

---

## License

MIT -- (c) 2025-2026 [hexplus](https://github.com/hexplus)
