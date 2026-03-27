import { effect } from "../core/signals/effect";
import { sanitizeUrl } from "../utils/sanitize";

// ============================================================================
// HEAD COMPONENT - Meta tag management for SEO
// ============================================================================

const HEAD_URL_ATTRS = new Set(["href", "src", "content"]);
function sanitizeHeadAttr(key: string, value: string): string {
  if (HEAD_URL_ATTRS.has(key)) return sanitizeUrl(value);
  return value;
}

interface HeadProps {
  title?: string | (() => string);
  meta?: Record<string, string | (() => string)>[];
  link?: Record<string, string>[];
  script?: Record<string, string>[];
  base?: { href?: string; target?: string };
}

/**
 * Head() manages document <head> tags reactively.
 * Supports dynamic title, meta tags, link tags, and structured data.
 * Each instance tracks its own elements and effects for independent cleanup.
 */
export function Head(props: HeadProps): Comment {
  const anchor = document.createComment("sibu-head");
  const managedElements: HTMLElement[] = [];
  const effectCleanups: Array<() => void> = [];

  // Cleanup this instance's managed elements and effects
  const cleanup = () => {
    for (const el of managedElements) {
      if (el.parentNode) el.parentNode.removeChild(el);
    }
    managedElements.length = 0;
    for (const cleanupFn of effectCleanups) cleanupFn();
    effectCleanups.length = 0;
  };

  const apply = () => {
    cleanup();

    // Title
    if (props.title) {
      if (typeof props.title === "function") {
        const cleanupFn = effect(() => {
          document.title = (props.title as () => string)();
        });
        effectCleanups.push(cleanupFn);
      } else {
        document.title = props.title;
      }
    }

    // Meta tags
    if (props.meta) {
      for (const metaProps of props.meta) {
        const el = document.createElement("meta");
        for (const [key, value] of Object.entries(metaProps)) {
          if (typeof value === "function") {
            const cleanupFn = effect(() => {
              el.setAttribute(key, (value as () => string)());
            });
            effectCleanups.push(cleanupFn);
          } else {
            el.setAttribute(key, value);
          }
        }
        document.head.appendChild(el);
        managedElements.push(el);
      }
    }

    // Link tags
    if (props.link) {
      for (const linkProps of props.link) {
        const el = document.createElement("link");
        for (const [key, value] of Object.entries(linkProps)) {
          el.setAttribute(key, sanitizeHeadAttr(key, value));
        }
        document.head.appendChild(el);
        managedElements.push(el);
      }
    }

    // Script tags
    if (props.script) {
      for (const scriptProps of props.script) {
        const el = document.createElement("script");
        for (const [key, value] of Object.entries(scriptProps)) {
          el.setAttribute(key, sanitizeHeadAttr(key, value));
        }
        document.head.appendChild(el);
        managedElements.push(el);
      }
    }

    // Base tag
    if (props.base) {
      const existing = document.head.querySelector("base");
      if (existing) existing.remove();
      const el = document.createElement("base");
      if (props.base.href) el.href = props.base.href;
      if (props.base.target) el.target = props.base.target;
      document.head.appendChild(el);
      managedElements.push(el);
    }
  };

  apply();

  return anchor;
}

/**
 * Sets structured data (JSON-LD) for SEO.
 */
export function setStructuredData(data: Record<string, unknown>): void {
  // Remove existing structured data
  const existing = document.head.querySelector('script[type="application/ld+json"][data-sibu]');
  if (existing) existing.remove();

  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.setAttribute("data-sibu", "true");
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
}

/**
 * Sets the canonical URL for the page.
 */
export function setCanonical(url: string): void {
  let link = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement;
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }
  link.href = sanitizeUrl(url);
}
