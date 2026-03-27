import { derived } from "../core/signals/derived";
import { signal } from "../core/signals/signal";
import { watch } from "../core/signals/watch";
import { batch } from "../reactivity/batch";

export interface ComboboxOptions<T> {
  items: T[];
  filterFn?: (item: T, query: string) => boolean;
  itemToString?: (item: T) => string;
}

export function combobox<T>(options: ComboboxOptions<T>): {
  query: () => string;
  setQuery: (q: string) => void;
  filteredItems: () => T[];
  selectedItem: () => T | null;
  select: (item: T) => void;
  highlightedIndex: () => number;
  highlightNext: () => void;
  highlightPrev: () => void;
  selectHighlighted: () => void;
  isOpen: () => boolean;
  open: () => void;
  close: () => void;
} {
  const { items, filterFn, itemToString } = options;

  const defaultFilterFn = (item: T, q: string): boolean => {
    const str = itemToString ? itemToString(item) : String(item);
    return str.toLowerCase().includes(q.toLowerCase());
  };

  const filter = filterFn ?? defaultFilterFn;

  const [query, setQuery] = signal<string>("");
  const [selectedItem, setSelectedItem] = signal<T | null>(null);
  const [highlightedIndex, setHighlightedIndex] = signal<number>(-1);
  const [isOpen, setIsOpen] = signal<boolean>(false);

  const filteredItems = derived<T[]>(() => {
    const q = query();
    if (q === "") return items;
    return items.filter((item) => filter(item, q));
  });

  // Reset highlighted index when the query changes (skips initial value)
  watch(query, () => {
    setHighlightedIndex(-1);
  });

  function select(item: T): void {
    batch(() => {
      setSelectedItem(item);
      const str = itemToString ? itemToString(item) : String(item);
      setQuery(str);
      setIsOpen(false);
    });
  }

  function highlightNext(): void {
    const filtered = filteredItems();
    if (filtered.length === 0) return;
    setHighlightedIndex((prev) => {
      const next = prev + 1;
      return next >= filtered.length ? 0 : next;
    });
  }

  function highlightPrev(): void {
    const filtered = filteredItems();
    if (filtered.length === 0) return;
    setHighlightedIndex((prev) => {
      const next = prev - 1;
      return next < 0 ? filtered.length - 1 : next;
    });
  }

  function selectHighlighted(): void {
    const filtered = filteredItems();
    const idx = highlightedIndex();
    if (idx >= 0 && idx < filtered.length) {
      select(filtered[idx]);
    }
  }

  function open(): void {
    setIsOpen(true);
  }

  function close(): void {
    setIsOpen(false);
  }

  return {
    query,
    setQuery,
    filteredItems,
    selectedItem,
    select,
    highlightedIndex,
    highlightNext,
    highlightPrev,
    selectHighlighted,
    isOpen,
    open,
    close,
  };
}
