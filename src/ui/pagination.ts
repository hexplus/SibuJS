import { derived } from "../core/signals/derived";
import { signal } from "../core/signals/signal";

/**
 * pagination provides reactive pagination state and controls.
 */
export function pagination(options: { totalItems: () => number; pageSize?: number; initialPage?: number }): {
  page: () => number;
  pageSize: () => number;
  totalPages: () => number;
  next: () => void;
  prev: () => void;
  goTo: (page: number) => void;
  startIndex: () => number;
  endIndex: () => number;
} {
  const pageSizeValue = options.pageSize ?? 10;
  const [page, setPage] = signal(options.initialPage ?? 1);
  const [pageSize] = signal(pageSizeValue);

  const totalPages = derived(() => {
    const total = options.totalItems();
    return Math.max(1, Math.ceil(total / pageSizeValue));
  });

  const startIndex = derived(() => {
    return (page() - 1) * pageSizeValue;
  });

  const endIndex = derived(() => {
    const end = page() * pageSizeValue;
    const total = options.totalItems();
    return Math.min(end, total);
  });

  function next(): void {
    if (page() < totalPages()) {
      setPage((p) => p + 1);
    }
  }

  function prev(): void {
    if (page() > 1) {
      setPage((p) => p - 1);
    }
  }

  function goTo(target: number): void {
    const clamped = Math.max(1, Math.min(target, totalPages()));
    setPage(clamped);
  }

  return { page, pageSize, totalPages, next, prev, goTo, startIndex, endIndex };
}
