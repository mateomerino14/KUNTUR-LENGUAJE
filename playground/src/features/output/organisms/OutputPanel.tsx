import type {Diagnostic, Position} from '../../../../../src/index.js';
import type {Execution} from '../../../hooks/useExecution';
import {DiagnosticItem} from '../molecules/DiagnosticItem';

interface OutputPanelProps {
  blocking: Diagnostic[];
  execution: Execution | null;
  onSelectPosition: (position: Position) => void;
}

const styles = {
  panel: 'p-5 flex flex-col gap-5',
  heading: 'text-[17px] font-bold',
  hint: 'text-[16px] text-ink-muted max-w-[60ch] leading-relaxed',
  diagnostics: 'flex flex-col gap-3',
  output: 'font-mono text-[15px] leading-[1.7] whitespace-pre-wrap break-words bg-paper border border-line rounded-md px-4 py-3',
  modeNote: 'text-[14px] text-ink-muted',
};

export const OutputPanel = ({blocking, execution, onSelectPosition}: OutputPanelProps) => {
  if (blocking.length > 0) {
    return (
      <section className={styles.panel}>
        <h2 className={styles.heading}>Hay que corregir esto antes de ejecutar</h2>
        <ul className={styles.diagnostics}>
          {blocking.map((diagnostic, index) => (
            <DiagnosticItem key={index} diagnostic={diagnostic} onSelectPosition={onSelectPosition} />
          ))}
        </ul>
      </section>
    );
  }
  if (execution === null) {
    return (
      <section className={styles.panel}>
        <p className={styles.hint}>Presiona Ejecutar o Ctrl + Enter para ver lo que muestra el programa.</p>
        <p className={styles.hint}>
          La franja de colores de arriba es el camino que recorre tu código: léxico, sintaxis, semántica, WebAssembly y ejecución. Cada color se completa cuando su etapa termina bien y se vuelve rojo si encuentra un error. Haz clic en una etapa para ver lo que produjo.
        </p>
      </section>
    );
  }
  return (
    <section className={styles.panel} aria-live="polite">
      <p className={styles.modeNote}>
        {execution.mode === 'wasm' ? 'Ejecutado como WebAssembly' : 'Ejecutado con el intérprete'}
      </p>
      {execution.output.length > 0 && <pre className={styles.output}>{execution.output.join('\n')}</pre>}
      {execution.output.length === 0 && execution.diagnostics.length === 0 && (
        <p className={styles.hint}>El programa terminó sin mostrar nada. Usa mostrar(...) para ver valores.</p>
      )}
      {execution.diagnostics.length > 0 && (
        <ul className={styles.diagnostics}>
          {execution.diagnostics.map((diagnostic, index) => (
            <DiagnosticItem key={index} diagnostic={diagnostic} onSelectPosition={onSelectPosition} />
          ))}
        </ul>
      )}
    </section>
  );
};
