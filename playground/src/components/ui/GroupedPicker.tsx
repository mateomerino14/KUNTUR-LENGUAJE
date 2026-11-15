import {useListbox} from '../../hooks/useListbox';

export interface PickerItem {
  id: string;
  name: string;
  description: string;
  group: string;
  done?: boolean;
}

interface GroupedPickerProps {
  idPrefix: string;
  label: string;
  emptyLabel: string;
  groups: {id: string; label: string}[];
  items: PickerItem[];
  value: string;
  onSelect: (id: string) => void;
}

const styles = {
  container: 'relative flex items-center gap-2',
  label: 'text-[15px] text-ink-muted',
  button: 'flex items-center justify-between gap-3 min-w-[230px] bg-paper border border-line rounded-md pl-3 pr-2 py-2 text-[15px] text-ink cursor-pointer hover:border-ink',
  buttonOpen: 'border-ink',
  chevron: 'w-4 h-4 text-ink-muted transition-transform motion-reduce:transition-none',
  chevronOpen: 'rotate-180',
  popover: 'absolute left-0 top-full mt-2 z-30 w-[min(380px,calc(100vw-2.5rem))] bg-paper border border-ink rounded-md overflow-hidden',
  edge: 'h-[5px] bg-[linear-gradient(90deg,var(--color-fuchsia)_0_20%,var(--color-mustard)_20%_40%,var(--color-teal)_40%_60%,var(--color-violet)_60%_80%,var(--color-blue)_80%)]',
  list: 'max-h-[min(70vh,520px)] overflow-y-auto py-2 outline-none',
  group: 'px-4 pt-3 pb-1 text-[13px] font-bold text-ink-muted',
  option: 'flex items-start justify-between gap-3 px-4 py-2 cursor-pointer border-l-[3px]',
  optionText: 'flex flex-col gap-[2px]',
  optionActive: 'bg-salt',
  optionSelected: 'border-ink',
  optionIdle: 'border-transparent',
  name: 'text-[15px] text-ink',
  nameSelected: 'font-bold',
  description: 'text-[13px] text-ink-muted',
  done: 'mt-[3px] w-[18px] h-[18px] shrink-0 text-teal',
};

const CheckIcon = ({className}: {className: string}) => (
  <svg className={className} viewBox="0 0 18 18" fill="none" role="img" aria-label="Resuelto">
    <circle cx="9" cy="9" r="8" stroke="currentColor" strokeWidth="1.6" />
    <path d="M5.5 9.2l2.3 2.3 4.7-4.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const GroupedPicker = ({idPrefix, label, emptyLabel, groups, items, value, onSelect}: GroupedPickerProps) => {
  const ordered = groups.flatMap((group) => items.filter((item) => item.group === group.id));
  const selectedIndex = ordered.findIndex((item) => item.id === value);
  const {container, button, list, ...listbox} = useListbox({
    count: ordered.length,
    selectedIndex,
    onSelect: (index) => onSelect(ordered[index].id),
  });
  const current = ordered[selectedIndex];
  const labelId = `${idPrefix}-etiqueta`;
  const buttonId = `${idPrefix}-boton`;
  return (
    <div className={styles.container} ref={container}>
      <span className={styles.label} id={labelId}>{label}</span>
      <button
        ref={button}
        type="button"
        className={`${styles.button} ${listbox.open ? styles.buttonOpen : ''}`}
        aria-haspopup="listbox"
        aria-expanded={listbox.open}
        aria-labelledby={`${labelId} ${buttonId}`}
        id={buttonId}
        onClick={listbox.toggle}
        onKeyDown={listbox.onButtonKeyDown}
      >
        <span>{current ? current.name : emptyLabel}</span>
        <svg className={`${styles.chevron} ${listbox.open ? styles.chevronOpen : ''}`} viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {listbox.open && (
        <div className={styles.popover}>
          <div className={styles.edge} />
          <ul
            ref={list}
            role="listbox"
            tabIndex={-1}
            aria-labelledby={labelId}
            aria-activedescendant={`${idPrefix}-${ordered[listbox.activeIndex].id}`}
            className={styles.list}
            onKeyDown={listbox.onListKeyDown}
          >
            {groups.map((group) => (
              <li key={group.id} role="presentation">
                <div className={styles.group} aria-hidden="true">{group.label}</div>
                <ul role="group" aria-label={group.label}>
                  {ordered.map((item, index) => item.group !== group.id ? null : (
                    <li
                      key={item.id}
                      id={`${idPrefix}-${item.id}`}
                      role="option"
                      data-index={index}
                      aria-selected={index === selectedIndex}
                      className={`${styles.option} ${index === listbox.activeIndex ? styles.optionActive : ''} ${index === selectedIndex ? styles.optionSelected : styles.optionIdle}`}
                      onMouseEnter={() => listbox.setActiveIndex(index)}
                      onClick={() => listbox.choose(index)}
                    >
                      <span className={styles.optionText}>
                        <span className={`${styles.name} ${index === selectedIndex ? styles.nameSelected : ''}`}>{item.name}</span>
                        <span className={styles.description}>{item.description}</span>
                      </span>
                      {item.done && <CheckIcon className={styles.done} />}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
