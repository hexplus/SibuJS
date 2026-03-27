import { derived } from "../core/signals/derived";
import { signal } from "../core/signals/signal";
import { batch } from "../reactivity/batch";

export interface SelectOptions<T> {
  items: T[];
  multiple?: boolean;
  itemToString?: (item: T) => string;
}

export function select<T>(options: SelectOptions<T>): {
  selectedItems: () => T[];
  selectedItem: () => T | null;
  select: (item: T) => void;
  deselect: (item: T) => void;
  toggle: (item: T) => void;
  isSelected: (item: T) => boolean;
  isOpen: () => boolean;
  open: () => void;
  close: () => void;
  highlightedIndex: () => number;
  highlightNext: () => void;
  highlightPrev: () => void;
  selectHighlighted: () => void;
  clear: () => void;
} {
  const { items, multiple = false } = options;

  const [selectedItems, setSelectedItems] = signal<T[]>([]);
  const [isOpen, setIsOpen] = signal<boolean>(false);
  const [highlightedIndex, setHighlightedIndex] = signal<number>(-1);

  const selectedItem = derived<T | null>(() => {
    const sel = selectedItems();
    return sel.length > 0 ? sel[sel.length - 1] : null;
  });

  function select(item: T): void {
    if (multiple) {
      setSelectedItems((prev) => {
        if (prev.includes(item)) return prev;
        return [...prev, item];
      });
    } else {
      batch(() => {
        setSelectedItems([item]);
        setIsOpen(false);
      });
    }
  }

  function deselect(item: T): void {
    setSelectedItems((prev) => prev.filter((i) => i !== item));
  }

  function toggle(item: T): void {
    if (selectedItems().includes(item)) {
      deselect(item);
    } else {
      select(item);
    }
  }

  function isSelected(item: T): boolean {
    return selectedItems().includes(item);
  }

  function open(): void {
    setIsOpen(true);
  }

  function close(): void {
    setIsOpen(false);
  }

  function highlightNext(): void {
    if (items.length === 0) return;
    setHighlightedIndex((prev) => {
      const next = prev + 1;
      return next >= items.length ? 0 : next;
    });
  }

  function highlightPrev(): void {
    if (items.length === 0) return;
    setHighlightedIndex((prev) => {
      const next = prev - 1;
      return next < 0 ? items.length - 1 : next;
    });
  }

  function selectHighlighted(): void {
    const idx = highlightedIndex();
    if (idx >= 0 && idx < items.length) {
      select(items[idx]);
    }
  }

  function clear(): void {
    setSelectedItems([]);
  }

  return {
    selectedItems,
    selectedItem,
    select,
    deselect,
    toggle,
    isSelected,
    isOpen,
    open,
    close,
    highlightedIndex,
    highlightNext,
    highlightPrev,
    selectHighlighted,
    clear,
  };
}
