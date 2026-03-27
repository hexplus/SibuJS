// ============================================================================
// SCOPED STYLE ISOLATION
// ============================================================================

let scopeCounter = 0;

/**
 * scopedStyle creates component-scoped CSS by generating a unique scope ID
 * and prefixing all selectors.
 * Returns the scope attribute name and injects the CSS into the document.
 */
export function scopedStyle(css: string): { scope: string; attr: string } {
  const id = `sibu-s${scopeCounter++}`;
  const attr = `data-${id}`;

  // Prefix all CSS selectors with the scope attribute
  const scopedCSS = css.replace(/([^\r\n,{}]+)(,(?=[^}]*{)|\s*{)/g, (match, selector, delimiter) => {
    const trimmed = selector.trim();
    // Skip @-rules and keyframe selectors
    if (trimmed.startsWith("@") || trimmed.startsWith("from") || trimmed.startsWith("to") || /^\d+%$/.test(trimmed)) {
      return match;
    }
    return `${trimmed}[${attr}]${delimiter}`;
  });

  // Inject into document (skip during SSR)
  if (typeof document !== "undefined") {
    const styleEl = document.createElement("style");
    styleEl.setAttribute("data-sibu-scope", id);
    styleEl.textContent = scopedCSS;
    document.head.appendChild(styleEl);
  }

  return { scope: id, attr };
}

/**
 * withScopedStyle wraps a component function to auto-apply scoped styles.
 * The component and all its children get the scope attribute.
 */
export function withScopedStyle<P>(css: string, component: (props: P) => HTMLElement): (props: P) => HTMLElement {
  let style: { scope: string; attr: string } | null = null;

  return (props: P) => {
    // Lazy-inject: only create the style on first render
    if (!style) {
      style = scopedStyle(css);
    }
    const el = component(props);
    applyScopeRecursive(el, style.attr);
    return el;
  };
}

function applyScopeRecursive(element: HTMLElement, attr: string): void {
  element.setAttribute(attr, "");
  for (const child of Array.from(element.children)) {
    if (child instanceof HTMLElement) {
      applyScopeRecursive(child, attr);
    }
  }
}

/**
 * Removes a scoped style by its scope ID.
 */
export function removeScopedStyle(scopeId: string): void {
  const el = document.head.querySelector(`style[data-sibu-scope="${scopeId}"]`);
  if (el) el.remove();
}
