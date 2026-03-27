/**
 * Portal renders nodes into a DOM node outside the parent component hierarchy.
 * Useful for modals, tooltips, dropdowns, and overlays.
 *
 * @param nodes Function that returns the content to render
 * @param target Target DOM element (defaults to document.body)
 * @returns A Comment anchor node in the original position
 *
 * @example
 * ```ts
 * // Render modal at document.body
 * Portal(() => div({ class: "modal", nodes: "Modal content" }));
 *
 * // Render into specific container
 * const overlay = document.getElementById("overlay-root")!;
 * Portal(() => div({ nodes: "Tooltip" }), overlay);
 * ```
 */
export function Portal(nodes: () => HTMLElement, target?: HTMLElement): Comment {
  const anchor = document.createComment("portal");
  const container = target || document.body;
  let portalContent: HTMLElement | null = null;

  queueMicrotask(() => {
    try {
      portalContent = nodes();
      container.appendChild(portalContent);
    } catch (err) {
      console.error("[Portal] Render error:", err);
    }
  });

  // Cleanup when anchor is removed from DOM
  const observer = new MutationObserver(() => {
    if (!anchor.isConnected && portalContent) {
      portalContent.remove();
      portalContent = null;
      observer.disconnect();
    }
  });

  queueMicrotask(() => {
    if (anchor.parentNode) {
      observer.observe(anchor.parentNode, { childList: true });
    }
  });

  return anchor;
}
