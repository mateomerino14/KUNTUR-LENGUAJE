interface InputBoxProps {
  value: string;
  onChange: (value: string) => void;
}

const styles = {
  group: 'flex flex-col gap-2',
  label: 'text-[15px] font-bold',
  hint: 'font-normal text-ink-muted',
  textarea: 'font-mono text-[15px] leading-[1.6] bg-paper border border-line rounded-md px-3 py-2 min-h-[5.5rem] resize-y focus:border-ink',
};

export const InputBox = ({value, onChange}: InputBoxProps) => (
  <label className={styles.group}>
    <span className={styles.label}>
      Entrada <span className={styles.hint}>una línea por cada leer()</span>
    </span>
    <textarea
      className={styles.textarea}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      spellCheck={false}
      rows={4}
    />
  </label>
);
