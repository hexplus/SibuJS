/**
 * Escapes HTML entities in a string to prevent XSS injection.
 * Used internally by bindTextNode for safe text node updates.
 * Also exported as a user-facing utility.
 */
export function sanitize(value: unknown): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Sanitizes a URL to prevent javascript: and data: protocol injection.
 * Allows http, https, mailto, tel, and relative URLs.
 *
 * @param url URL string to sanitize
 * @returns The URL if safe, or empty string if dangerous
 */
export function sanitizeUrl(url: string): string {
  // Strip ASCII control characters (C0 controls, 0x00-0x1F) that browsers
  // may silently ignore, which could bypass protocol checks.
  // E.g. "\x01javascript:alert(1)" would skip startsWith("javascript:").
  // Strip C0/C1 control characters and Unicode whitespace that browsers
  // may silently ignore, which could bypass protocol checks.
  // E.g. "\x01javascript:alert(1)" or "java\tscript:alert(1)"
  // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional — stripping control chars to prevent protocol bypass
  const trimmed = url.replace(/[\x00-\x20\x7f-\x9f]+/g, "").trim();
  if (!trimmed) return "";

  // Block dangerous protocols
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("blob:")
  ) {
    return "";
  }

  return trimmed;
}

/**
 * Sanitizes HTML by stripping all tags, leaving only text content.
 *
 * @param html HTML string to strip
 * @returns Plain text with all HTML tags removed
 */
export function stripHtml(html: string): string {
  return String(html).replace(/<[^>]*>/g, "");
}

// Default safe attributes that can be set without sanitization
const SAFE_ATTRIBUTES = new Set([
  "id",
  "class",
  "style",
  "title",
  "alt",
  "role",
  "tabindex",
  "hidden",
  "disabled",
  "readonly",
  "required",
  "placeholder",
  "name",
  "type",
  "value",
  "checked",
  "selected",
  "multiple",
  "min",
  "max",
  "step",
  "rows",
  "cols",
  "width",
  "height",
  "for",
  "aria-label",
  "aria-hidden",
  "aria-expanded",
  "aria-selected",
  "aria-describedby",
  "aria-labelledby",
  "aria-live",
  "data-*",
]);

// Attributes that hold URLs and need URL sanitization
const URL_ATTRIBUTES = new Set(["href", "src", "action", "formaction", "cite", "poster", "background", "srcset"]);

/**
 * Checks if an attribute name is safe to set without sanitization.
 */
export function isSafeAttribute(attr: string): boolean {
  if (SAFE_ATTRIBUTES.has(attr)) return true;
  if (attr.startsWith("data-")) return true;
  if (attr.startsWith("aria-")) return true;
  return false;
}

/**
 * Checks if an attribute holds a URL that needs sanitization.
 */
export function isUrlAttribute(attr: string): boolean {
  return URL_ATTRIBUTES.has(attr);
}

/**
 * Sanitizes an attribute value based on its name.
 * URL attributes get URL sanitization; others get HTML entity escaping.
 *
 * @public Exported for user-facing API — not used internally by the framework.
 * The framework uses setAttribute() directly (which is XSS-safe) and only
 * calls sanitizeUrl() for URL attributes.
 */
export function sanitizeAttribute(attr: string, value: string): string {
  if (isUrlAttribute(attr)) {
    return sanitizeUrl(value);
  }
  return sanitize(value);
}
