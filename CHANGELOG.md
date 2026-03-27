# Changelog

All notable changes to SibuJS will be documented in this file.

This project follows [Semantic Versioning](https://semver.org/).

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
