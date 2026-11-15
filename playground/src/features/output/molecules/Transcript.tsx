import type {TranscriptEntry} from '../../../hooks/useExecution';

interface TranscriptProps {
  entries: TranscriptEntry[];
}

const styles = {
  box: 'font-mono text-[15px] leading-[1.7] whitespace-pre-wrap break-words bg-paper border border-line rounded-md px-4 py-3 min-h-[2.75rem]',
  prompt: 'text-ink-muted',
  answer: 'text-teal font-bold underline decoration-teal/40 underline-offset-4',
};

export const Transcript = ({entries}: TranscriptProps) => (
  <div className={styles.box} role="log" aria-label="Lo que muestra el programa y lo que se le responde">
    {entries.map((entry, index) => (
      entry.kind === 'output' ? (
        <div key={index}>{entry.text}</div>
      ) : (
        <div key={index}>
          <span className={styles.prompt}>{entry.prompt}</span>
          <span className={styles.answer}>{entry.answer}</span>
        </div>
      )
    ))}
  </div>
);
