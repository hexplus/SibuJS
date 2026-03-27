# Changelog

All notable changes to SibuJS will be documented in this file.

This project follows [Semantic Versioning](https://semver.org/).

---

## [1.0.2] — 2026-03-27

### Fixed

- **`clearQueryCache()` now resets active queries** — Active subscribers get their signals reset (`data`, `error`, `isFetching`) and automatically refetch, instead of silently going stale.
- **`query()` cache entry recovery** — `doFetch()` recreates the cache entry if it was evicted mid-flight, preventing silent fetch failures.
- **`onCacheUpdate` handles missing entries** — Gracefully resets signals when a cache entry is cleared instead of bailing out silently.
- **`setData` propagates `undefined`** — `onCacheUpdate` now correctly syncs `undefined` data from cleared cache entries instead of skipping the update.

### Added

- **CI workflow** (`ci.yml`, `on: [pull_request]`) — GitHub Actions pipeline on pull requests: lint, test, and build (Node 20).

---

## [1.0.1] — 2026-03-27

### Security

- **DevTools disabled by default in production** — `initDevTools()` now defaults to `enabled: isDev()`. Production builds get a no-op API unless explicitly opted in, preventing signal/state exposure via `window.__SIBU_DEVTOOLS__`.
- **SSR error comments no longer leak internals** — Production renders `<!--SSR error-->` without the error message. Dev mode retains full details for debugging.
- **ErrorBoundary hides error details in production** — Default fallback shows a generic message instead of `err.message`, preventing exposure of file paths, DB strings, or stack traces.
- **CSP nonce support for SSR inline scripts** — `suspenseSwapScript(id, nonce?)` and `serializeState(state, nonce?)` accept an optional nonce for strict Content Security Policy compliance.
- **CSS injection guard** — New `sanitizeCSSValue()` blocks `url()`, `expression()`, `javascript:`, and `-moz-binding` in style property values. Applied automatically in `tagFactory` style bindings.
- **`persisted()` encryption support** — New `encrypt`/`decrypt` options for data-at-rest protection in localStorage/sessionStorage.
- **SSR state deserialization validation** — `deserializeState(validate?)` accepts an optional type guard to reject tampered payloads.

---

## [1.0.0] — 2026-03-27

### Added

- **`KeepAlive`** — Caches component DOM subtrees by key, preserving reactive bindings when switching views. Supports LRU eviction via `{ max }` option. Unlike `when()`/`match()`, toggling does NOT dispose the previous branch — scroll position, form state, and signal subscriptions survive.
- **`action()`** — Reusable element-level behaviors with automatic disposal. Built-in actions: `clickOutside` (close on outside click), `longPress` (sustained press detection), `trapFocus` (keyboard focus trapping for a11y). Custom actions return a cleanup function.
- **`writable()`** — Computed with setter. Combines a `derived()` getter with a user-provided setter for two-way computed state. Setter is automatically batched.
- **`springSignal()`** — Reactive spring-animated value with physics simulation (stiffness, damping, precision). Animates toward target via `requestAnimationFrame`. Respects `prefers-reduced-motion` (snaps instantly). Returns `[get, set, dispose]` tuple. Import from `sibujs/motion`.
- **`on()`** — Explicit dependency specification for effects. Only the deps getter is tracked; the handler runs untracked. Provides `(value, prev)` callback signature.
- **`untracked()`** — Execute a function without tracking signal reads as dependencies. Wraps the internal `suspendTracking()`/`resumeTracking()` pair.
- **`signal()` `equals` option** — Custom equality function via `signal(value, { equals: (a, b) => boolean })`. Defaults to `Object.is()`. `deepSignal` refactored to delegate to `signal()` with `equals: deepEqual`, eliminating code duplication.
- **`effect()` `onError` option** — Optional error handler via `effect(fn, { onError: (err) => ... })`. Zero overhead when not provided (no wrapper closure).

### Changed

- **`batch()` returns the callback's value** — Signature changed from `(fn: () => void): void` to `<T>(fn: () => T): T`. Existing code is unaffected (void return still works).
- **`deepSignal` refactored** — Now delegates to `signal()` with `equals: deepEqual`. Gains devtools support for free. `deepEqual()` is now exported for reuse.

### Fixed

- **Notification queue isolation** — One failing subscriber no longer crashes remaining subscribers. All subscriber invocation points in `track.ts` are wrapped in `safeInvoke()` with dev-mode warnings.
- **Dev-mode warnings in silent binding catches** — `bindAttribute` and `bindChildNode` now log `devWarn()` instead of silently swallowing errors. Zero cost in production (tree-shaken).
- **Lifecycle error protection** — `onMount`/`onUnmount` callbacks wrapped in `safeCall()` — throwing callbacks no longer crash the microtask queue or MutationObserver.
- **Per-item error isolation in `each()`** — A throwing render function for one item no longer kills the entire list. Failed items render as comment node placeholders; other items render normally.
- **SSR error handling** — `renderToString`, `renderToStream`, and `renderToDocument` now catch errors per child node, rendering `<!--SSR error: ...-->` comments instead of crashing the server. Error messages are HTML-escaped for security.

---

## [1.0.0-beta.7] — 2026-03-26

### Changed

- **derived() re-tracks dependencies on re-evaluation** — `computedGetter` now uses `track()` instead of `suspendTracking()` when re-evaluating, so derived-of-derived chains propagate correctly. Formula cells like `=SUM(F2:F4)` where F2 is itself `=SUM(B2:E2)` now update automatically.
- **propagateDirty simplified** — removed eager evaluation path; dirty flags propagate through the chain and lazy pull via `computedGetter` + `track()` handles re-evaluation with correct dependency registration.

### Added

- **`lazyEffect()`** — `import { lazyEffect } from "sibujs/ui"` — creates effects that only activate when the target element is visible (via IntersectionObserver). When the element leaves the viewport, the effect is disposed. Ideal for large grids with thousands of cells.
- Spreadsheet showcase demo upgraded: safe math parser (CSP-safe, no `eval`/`new Function`), circular reference detection (`#CIRC`), `lazyEffect` for scalable cell rendering

---

## [1.0.0-beta.6] — 2026-03-26

### Changed

- **ref() is now reactive** — reading `.current` tracks dependencies, writing `.current` notifies subscribers. Works directly with `resize()`, `draggable()`, `dropZone()`, and other APIs that accept reactive getters
- **Browser APIs accept ref or getter** — `resize()`, `draggable()`, `dropZone()` now accept `Ref<HTMLElement> | (() => HTMLElement | null)`
- **debugValue() is now reactive** — uses `effect()` internally to track signal changes; returns a dispose function
- **Router lazy() uses symbol marker** — `isAsyncComponent` now checks `Symbol.for("sibujs:lazy")` instead of relying on `AsyncFunction` constructor name heuristic
- **Widget reactive accessor methods** — `tabs().isActive(id)`, `accordion().isExpanded(id)`, `datePicker().isSelected(date)` — safe to use inside `each()` render callbacks

### Added

- **`onElement` prop** in tag factories — `input({ onElement: (el) => mask.bind(el) })` — called after element creation for imperative bindings
- 93+ interactive examples in sibujs-test covering every module
- 10-tab examples page in sibujs-web (Showcase, Core, Data, Browser, Patterns, Motion, UI & Widgets, Plugins, DevTools, Performance)
- Spreadsheet showcase demo (reactive formulas, SUM, keyboard navigation, cell editing)

## [1.0.0-beta.5] — 2026-03-26

### Fixed

- Comprehensive framework review: fix 23 bugs, clean up module structure
- Update documentation and module exports

---

## [1.0.0-beta.4] — 2026-03-26

### Fixed

- Correct subpackage import paths in README and documentation
- Update package references across all entry points

---

## [1.0.0-beta.3] — 2026-03-25

### Fixed

- Handle array expressions in `html` tagged template engine
- Documentation updates

---

## [1.0.0-beta.2] — 2026-03-25

### Changed

- Optimize reactivity core, `tagFactory`, and `html` template engine for performance
- General improvements and cleanup

### Fixed

- Update all references to match current `sibujs` API (renamed from old `sibu` naming)

---

## [1.0.0-beta.1] — 2026-03-20

Initial public beta release.
