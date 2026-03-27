import { derived } from "../core/signals/derived";
import { signal } from "../core/signals/signal";

export interface TabsOptions {
  tabs: Array<{ id: string; label: string; disabled?: boolean }>;
  defaultTab?: string;
}

export function tabs(options: TabsOptions): {
  activeTab: () => string;
  setActiveTab: (id: string) => void;
  tabs: () => Array<{ id: string; label: string; disabled?: boolean; isActive: boolean }>;
  nextTab: () => void;
  prevTab: () => void;
  isActive: (id: string) => boolean;
} {
  const { tabs: tabDefs, defaultTab } = options;

  // Default to the first non-disabled tab, or the explicit default
  const initialTab = defaultTab ?? tabDefs.find((t) => !t.disabled)?.id ?? tabDefs[0]?.id ?? "";

  const [activeTab, setActiveTabState] = signal<string>(initialTab);

  function setActiveTab(id: string): void {
    const tab = tabDefs.find((t) => t.id === id);
    if (tab && !tab.disabled) {
      setActiveTabState(id);
    }
  }

  const tabs = derived(() =>
    tabDefs.map((t) => ({
      ...t,
      isActive: t.id === activeTab(),
    })),
  );

  function findCurrentIndex(): number {
    return tabDefs.findIndex((t) => t.id === activeTab());
  }

  function nextTab(): void {
    const currentIdx = findCurrentIndex();
    const len = tabDefs.length;
    if (len === 0) return;

    // Search forward, wrapping around, skipping disabled tabs
    for (let i = 1; i <= len; i++) {
      const candidate = tabDefs[(currentIdx + i) % len];
      if (!candidate.disabled) {
        setActiveTabState(candidate.id);
        return;
      }
    }
  }

  function prevTab(): void {
    const currentIdx = findCurrentIndex();
    const len = tabDefs.length;
    if (len === 0) return;

    // Search backward, wrapping around, skipping disabled tabs
    for (let i = 1; i <= len; i++) {
      const candidate = tabDefs[(currentIdx - i + len) % len];
      if (!candidate.disabled) {
        setActiveTabState(candidate.id);
        return;
      }
    }
  }

  /** Check if a specific tab is active (reactive getter — safe inside each()) */
  function isActive(id: string): boolean {
    return activeTab() === id;
  }

  return {
    activeTab,
    setActiveTab,
    tabs,
    nextTab,
    prevTab,
    /** Reactive check — use inside class/nodes bindings for per-tab reactivity */
    isActive,
  };
}
