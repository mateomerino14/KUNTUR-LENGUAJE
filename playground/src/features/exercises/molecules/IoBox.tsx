interface IoBoxProps {
  title: string;
  lines: string[];
  emptyText: string;
  highlight?: number;
}

const styles = {
  box: 'flex flex-col gap-1 min-w-0',
  title: 'text-[14px] font-bold text-ink-muted',
  content: 'font-mono text-[14px] leading-[1.6] bg-paper border border-line rounded-md px-3 py-2 min-h-[2.5rem] whitespace-pre-wrap break-words',
  empty: 'text-ink-muted',
  highlight: 'bg-error-soft text-error font-bold',
};

export const IoBox = ({title, lines, emptyText, highlight = -1}: IoBoxProps) => (
  <div className={styles.box}>
    <span className={styles.title}>{title}</span>
    <div className={styles.content}>
      {lines.length === 0 && highlight === -1 && <span className={styles.empty}>{emptyText}</span>}
      {lines.map((line, index) => (
        <div key={index} className={index === highlight ? styles.highlight : ''}>{line === '' ? ' ' : line}</div>
      ))}
      {highlight >= lines.length && <div className={styles.highlight}>(nada)</div>}
    </div>
  </div>
);
