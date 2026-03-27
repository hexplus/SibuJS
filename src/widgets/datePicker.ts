import { derived } from "../core/signals/derived";
import { signal } from "../core/signals/signal";

export interface DatePickerOptions {
  initialDate?: Date;
  minDate?: Date;
  maxDate?: Date;
}

export function datePicker(options?: DatePickerOptions): {
  selectedDate: () => Date | null;
  select: (date: Date) => void;
  viewDate: () => Date;
  setViewDate: (date: Date) => void;
  nextMonth: () => void;
  prevMonth: () => void;
  nextYear: () => void;
  prevYear: () => void;
  daysInMonth: () => Array<{
    date: Date;
    isCurrentMonth: boolean;
    isToday: boolean;
    isSelected: boolean;
    isDisabled: boolean;
  }>;
  isDateDisabled: (date: Date) => boolean;
} {
  const minDate = options?.minDate;
  const maxDate = options?.maxDate;
  const initialDate = options?.initialDate ?? null;

  const [selectedDate, setSelectedDate] = signal<Date | null>(initialDate);
  const [viewDate, setViewDate] = signal<Date>(initialDate ?? new Date());

  function isDateDisabled(date: Date): boolean {
    const d = stripTime(date);
    if (minDate && d < stripTime(minDate)) return true;
    if (maxDate && d > stripTime(maxDate)) return true;
    return false;
  }

  function stripTime(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function sameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  function select(date: Date): void {
    if (!isDateDisabled(date)) {
      setSelectedDate(date);
    }
  }

  function nextMonth(): void {
    setViewDate((prev) => {
      const next = new Date(prev);
      next.setMonth(next.getMonth() + 1);
      return next;
    });
  }

  function prevMonth(): void {
    setViewDate((prev) => {
      const next = new Date(prev);
      next.setMonth(next.getMonth() - 1);
      return next;
    });
  }

  function nextYear(): void {
    setViewDate((prev) => {
      const next = new Date(prev);
      next.setFullYear(next.getFullYear() + 1);
      return next;
    });
  }

  function prevYear(): void {
    setViewDate((prev) => {
      const next = new Date(prev);
      next.setFullYear(next.getFullYear() - 1);
      return next;
    });
  }

  const daysInMonth = derived(() => {
    const vd = viewDate();
    const year = vd.getFullYear();
    const month = vd.getMonth();
    const today = new Date();
    const selected = selectedDate();

    // First day of the month
    const firstDay = new Date(year, month, 1);
    // Day of week for first day (0 = Sunday)
    const startDow = firstDay.getDay();

    // Last day of the month
    const lastDay = new Date(year, month + 1, 0);
    const totalDaysInMonth = lastDay.getDate();

    const days: Array<{
      date: Date;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      isDisabled: boolean;
    }> = [];

    // Fill leading days from previous month
    for (let i = startDow - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      days.push({
        date,
        isCurrentMonth: false,
        isToday: sameDay(date, today),
        isSelected: selected !== null && sameDay(date, selected),
        isDisabled: isDateDisabled(date),
      });
    }

    // Fill current month days
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const date = new Date(year, month, d);
      days.push({
        date,
        isCurrentMonth: true,
        isToday: sameDay(date, today),
        isSelected: selected !== null && sameDay(date, selected),
        isDisabled: isDateDisabled(date),
      });
    }

    // Fill trailing days to complete the last week (rows of 7)
    const remaining = days.length % 7;
    if (remaining > 0) {
      const trailingCount = 7 - remaining;
      for (let i = 1; i <= trailingCount; i++) {
        const date = new Date(year, month + 1, i);
        days.push({
          date,
          isCurrentMonth: false,
          isToday: sameDay(date, today),
          isSelected: selected !== null && sameDay(date, selected),
          isDisabled: isDateDisabled(date),
        });
      }
    }

    return days;
  });

  /** Check if a specific date is selected (reactive — safe inside each/map) */
  function isSelected(date: Date): boolean {
    const sel = selectedDate();
    return sel !== null && sameDay(date, sel);
  }

  return {
    selectedDate,
    select,
    viewDate,
    setViewDate,
    nextMonth,
    prevMonth,
    nextYear,
    prevYear,
    daysInMonth,
    isDateDisabled,
    /** Reactive check — use inside class bindings for per-day reactivity */
    isSelected,
  };
}
