import {useRef, type KeyboardEvent, type ReactNode} from 'react';

interface Tab<T extends string> {
  id: T;
  label: string;
}

interface TabsProps<T extends string> {
  tabs: Tab<T>[];
  active: T;
  onChange: (id: T) => void;
  children: ReactNode;
}

const styles = {
  list: 'flex gap-1 overflow-x-auto border-b border-line px-3',
  tab: 'px-3 py-3 text-[15px] whitespace-nowrap cursor-pointer border-b-[3px] -mb-px',
  active: 'border-ink text-ink font-bold',
  inactive: 'border-transparent text-ink-muted hover:text-ink',
  panel: 'flex-1 min-h-0 overflow-auto',
};

export const Tabs = <T extends string>({tabs, active, onChange, children}: TabsProps<T>) => {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const moveFocus = (event: KeyboardEvent, index: number) => {
    let next = index;
    if (event.key === 'ArrowRight') {
      next = (index + 1) % tabs.length;
    }
    else if (event.key === 'ArrowLeft') {
      next = (index - 1 + tabs.length) % tabs.length;
    }
    else {
      return;
    }
    event.preventDefault();
    onChange(tabs[next].id);
    buttons.current[next]?.focus();
  };
  return (
    <>
      <div className={styles.list} role="tablist" aria-label="Vistas del programa">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={tab.id === active}
            aria-controls={`panel-${tab.id}`}
            tabIndex={tab.id === active ? 0 : -1}
            className={`${styles.tab} ${tab.id === active ? styles.active : styles.inactive}`}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => moveFocus(event, index)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className={styles.panel} role="tabpanel" id={`panel-${active}`} aria-labelledby={`tab-${active}`}>
        {children}
      </div>
    </>
  );
};
