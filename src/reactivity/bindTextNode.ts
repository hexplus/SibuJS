import { track } from "./track";

/**
 * Binds a reactive getter to a Text node, updating its content reactively.
 * Render errors are swallowed to preserve last displayed text.
 *
 * textContent is inherently XSS-safe — it sets plain text, never parsing HTML.
 *
 * @param textNode Target Text node whose content will be updated
 * @param getter Function returning string or number to display
 * @returns Teardown function to cancel the binding
 */
export function bindTextNode(textNode: Text, getter: () => string | number): () => void {
  function commit() {
    let value: string | number;
    try {
      value = getter();
    } catch {
      return;
    }
    textNode.textContent = String(value);
  }

  // Initial render and reactive subscription
  const teardown = track(commit);
  return teardown;
}
