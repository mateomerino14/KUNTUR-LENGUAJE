import type {TraceVariable} from '../../../../../src/index.js';

interface VariableListProps {
  title: string;
  variables: TraceVariable[];
  emptyText: string;
}

const kindNotes: Partial<Record<TraceVariable['kind'], string>> = {
  constant: 'constante',
  loop: 'variable del ciclo',
};

const styles = {
  group: 'flex flex-col gap-2',
  title: 'text-[15px] font-bold',
  empty: 'text-[15px] text-ink-muted',
  list: 'flex flex-col border border-line rounded-md bg-paper divide-y divide-line',
  item: 'flex flex-wrap items-baseline gap-x-3 px-3 py-2',
  name: 'font-mono font-bold',
  value: 'font-mono text-blue break-all',
  note: 'text-[13px] text-ink-muted',
};

export const VariableList = ({title, variables, emptyText}: VariableListProps) => (
  <div className={styles.group}>
    <h3 className={styles.title}>{title}</h3>
    {variables.length === 0 ? (
      <p className={styles.empty}>{emptyText}</p>
    ) : (
      <ul className={styles.list}>
        {variables.map((variable) => (
          <li key={variable.name} className={styles.item}>
            <span className={styles.name}>{variable.name}</span>
            <span className={styles.value}>{variable.value}</span>
            {kindNotes[variable.kind] && <span className={styles.note}>{kindNotes[variable.kind]}</span>}
          </li>
        ))}
      </ul>
    )}
  </div>
);
