interface Option<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}

const styles = {
  group: 'inline-flex rounded-md border border-line bg-paper p-[3px]',
  option: 'px-3 py-[6px] rounded text-[14px] cursor-pointer',
  active: 'bg-ink text-paper font-bold',
  inactive: 'text-ink-muted hover:text-ink',
};

export const SegmentedControl = <T extends string>({label, options, value, onChange}: SegmentedControlProps<T>) => (
  <div className={styles.group} role="radiogroup" aria-label={label}>
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        role="radio"
        aria-checked={option.value === value}
        className={`${styles.option} ${option.value === value ? styles.active : styles.inactive}`}
        onClick={() => onChange(option.value)}
      >
        {option.label}
      </button>
    ))}
  </div>
);
