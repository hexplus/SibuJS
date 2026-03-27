import { derived } from "../core/signals/derived";
import { signal } from "../core/signals/signal";

export interface AccordionOptions {
  items: Array<{ id: string; label: string }>;
  multiple?: boolean;
  defaultExpanded?: string[];
}

export function accordion(options: AccordionOptions): {
  items: () => Array<{ id: string; label: string; isExpanded: boolean }>;
  toggle: (id: string) => void;
  expand: (id: string) => void;
  collapse: (id: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
} {
  const { items: itemDefs, multiple = false, defaultExpanded = [] } = options;

  const [expandedIds, setExpandedIds] = signal<Set<string>>(new Set(defaultExpanded));

  const items = derived(() =>
    itemDefs.map((item) => ({
      ...item,
      isExpanded: expandedIds().has(item.id),
    })),
  );

  function expand(id: string): void {
    if (!itemDefs.some((item) => item.id === id)) return;

    if (multiple) {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    } else {
      // Single mode: only this item is expanded
      setExpandedIds(new Set([id]));
    }
  }

  function collapse(id: string): void {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function toggle(id: string): void {
    if (expandedIds().has(id)) {
      collapse(id);
    } else {
      expand(id);
    }
  }

  function expandAll(): void {
    if (multiple) {
      setExpandedIds(new Set(itemDefs.map((item) => item.id)));
    }
  }

  function collapseAll(): void {
    setExpandedIds(new Set());
  }

  /** Check if a specific item is expanded (reactive getter — safe inside each()) */
  function isExpanded(id: string): boolean {
    return expandedIds().has(id);
  }

  return {
    items,
    toggle,
    expand,
    collapse,
    expandAll,
    collapseAll,
    /** Reactive check — use inside class/nodes bindings for per-item reactivity */
    isExpanded,
  };
}
