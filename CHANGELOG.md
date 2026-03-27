# Changelog

All notable changes to SibuJS will be documented in this file.

This project follows [Semantic Versioning](https://semver.org/).

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

### Fixed
- **Empty string attributes now set correctly** — `[style.attr]: ""` works for `scopedStyle()`. Changed boolean check from `if (value)` to `if (value === true)` / `if (value === false)` in tagFactory
- Fix `scopedStyle()` examples — use `el.setAttribute()` instead of template interpolation
- Fix `inputMask()` examples — bind imperatively instead of ref+effect
- Fix `intersection()` examples — call `observe()` after element creation
- Fix `tabs()` / `accordion()` / `datePicker()` examples — use reactive accessors instead of static snapshots from `each()`
- Fix `RenderProp()` example — use reactive nodes inside render function
- Fix router `lazy()` — plain functions returning Promises now detected correctly
- Fix `stream()` demo — removed broken httpbin.org endpoint
- Fix `toast()` styling — type-specific colors (info/success/error/warning)
- Fix `DOMPool` demo — stats synced after release, shows recycled elements
- Fix `checkLeaks()` demo — uses `trackCleanup()`/`runCleanups()` for real leak detection

---

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
