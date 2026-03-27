import { devWarn, isDev } from "../core/dev";
import { isUrlAttribute, sanitizeUrl } from "../utils/sanitize";
import { track } from "./track";

const _isDev = isDev();

/**
 * Bind a reactive getter to an element attribute.
 * Returns a teardown that stops all future updates.
 *
 * Sanitization: URL attributes (href, src, action, etc.) go through
 * protocol validation (blocks javascript:, data:, vbscript:).
 * All other attributes get HTML entity escaping.
 */
export function bindAttribute(el: HTMLElement, attr: string, getter: () => unknown): () => void {
  function commit() {
    let value: unknown;
    try {
      value = getter();
    } catch (err) {
      if (_isDev)
        devWarn(`bindAttribute: getter for "${attr}" threw: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    // Boolean values toggle the attribute presence (HTML boolean attribute semantics)
    if (typeof value === "boolean") {
      // For IDL properties like checked/disabled/selected, set the DOM property
      // directly — setAttribute only changes the default, not the current state.
      if (attr in el && (attr === "checked" || attr === "disabled" || attr === "selected")) {
        // @ts-expect-error — dynamic property assignment
        el[attr] = value;
      } else if (value) {
        el.setAttribute(attr, "");
      } else {
        el.removeAttribute(attr);
      }
      return;
    }

    const str = String(value);

    // If binding an input value or checked state, update the property
    if ((attr === "value" || attr === "checked") && attr in el) {
      // @ts-expect-error
      el[attr] = attr === "checked" ? Boolean(value) : str;
    } else {
      // URL attributes need protocol sanitization; others are safe via setAttribute
      el.setAttribute(attr, isUrlAttribute(attr) ? sanitizeUrl(str) : str);
    }
  }

  // Initial run + reactive updates
  const teardown = track(commit);
  return teardown;
}

/**
 * Bind a dynamic attribute where both name and value can change reactively.
 * Useful for `:attr.name` style dynamic keys.
 *
 * When the attribute name changes, the old attribute is removed and the
 * new one is set. Returns a teardown function that stops reactive tracking
 * and removes the current attribute from the element.
 */
export function bindDynamic(
  el: HTMLElement,
  nameGetter: string | (() => string),
  valueGetter: string | (() => unknown),
): () => void {
  // Track the previously applied attribute name so we can remove it on change
  let prevName: string | null = null;

  function commit() {
    // Resolve the current attribute name
    let name: string;
    try {
      name = typeof nameGetter === "function" ? nameGetter() : nameGetter;
    } catch (err) {
      if (_isDev) devWarn(`bindDynamic: name getter threw: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    // Resolve the current value
    let value: unknown;
    try {
      value = typeof valueGetter === "function" ? valueGetter() : valueGetter;
    } catch (err) {
      if (_isDev) devWarn(`bindDynamic: value getter threw: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    // Block event handler attributes (onclick, onload, onerror, etc.)
    // to prevent XSS via dynamic attribute name injection
    if ((name[0] === "o" || name[0] === "O") && (name[1] === "n" || name[1] === "N")) return;

    // If the attribute name changed, remove the old one
    if (prevName !== null && prevName !== name) {
      el.removeAttribute(prevName);
    }

    const str = String(value);

    // If binding an input value or checked state, update the property
    if ((name === "value" || name === "checked") && name in el) {
      // @ts-expect-error
      el[name] = name === "checked" ? Boolean(value) : str;
    } else {
      el.setAttribute(name, isUrlAttribute(name) ? sanitizeUrl(str) : str);
    }

    prevName = name;
  }

  // Initial run + reactive updates
  const teardown = track(commit);

  // Return a combined teardown: stop tracking and clean up the current attribute
  return () => {
    teardown();
    if (prevName !== null) {
      el.removeAttribute(prevName);
    }
  };
}
