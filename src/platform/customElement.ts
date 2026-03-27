// ============================================================================
// CUSTOM ELEMENTS (WEB COMPONENTS)
// ============================================================================

export interface CustomElementOptions {
  shadow?: boolean;
  mode?: "open" | "closed";
  styles?: string;
  observedAttributes?: string[];
  extends?: string;
}

/**
 * defineElement creates a Web Component wrapping a SibuJS component function.
 */
export function defineElement(
  name: string,
  component: (props: Record<string, unknown>, element: HTMLElement) => HTMLElement,
  options: CustomElementOptions = {},
): void {
  if (customElements.get(name)) return;

  const observed = options.observedAttributes || [];

  class SibuElement extends HTMLElement {
    private _root: HTMLElement | ShadowRoot;
    private _rendered = false;

    static get observedAttributes(): string[] {
      return observed;
    }

    constructor() {
      super();
      if (options.shadow !== false) {
        this._root = this.attachShadow({ mode: options.mode || "open" });
      } else {
        this._root = this;
      }
    }

    connectedCallback(): void {
      this._render();
    }

    disconnectedCallback(): void {
      // Cleanup rendered content
      if (this._root instanceof ShadowRoot) {
        this._root.innerHTML = "";
      }
      this._rendered = false;
    }

    attributeChangedCallback(): void {
      if (this._rendered) {
        this._render();
      }
    }

    private _render(): void {
      const props = this._getProps();

      // Clear
      if (this._root instanceof ShadowRoot) {
        this._root.innerHTML = "";
      } else {
        while (this._root.firstChild) {
          this._root.removeChild(this._root.firstChild);
        }
      }

      // Add styles if shadow DOM
      if (options.styles && this._root instanceof ShadowRoot) {
        const styleEl = document.createElement("style");
        styleEl.textContent = options.styles;
        this._root.appendChild(styleEl);
      }

      const el = component(props, this);
      this._root.appendChild(el);
      this._rendered = true;
    }

    private _getProps(): Record<string, unknown> {
      const props: Record<string, unknown> = {};
      for (const attr of this.attributes) {
        props[attr.name] = attr.value;
      }
      return props;
    }
  }

  customElements.define(name, SibuElement);
}

/**
 * Creates an SVG element with proper namespace.
 */
export function svgElement(
  tag: string,
  props: Record<string, unknown> = {},
  ...nodes: (SVGElement | string)[]
): SVGElement {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const el = document.createElementNS(SVG_NS, tag);

  for (const [key, value] of Object.entries(props)) {
    if (key === "nodes") continue;
    if (typeof value === "function" && key.startsWith("on")) {
      el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else if (value != null) {
      el.setAttribute(key, String(value));
    }
  }

  for (const child of nodes) {
    if (typeof child === "string") {
      el.appendChild(document.createTextNode(child));
    } else if (child instanceof Node) {
      el.appendChild(child);
    }
  }

  return el;
}
