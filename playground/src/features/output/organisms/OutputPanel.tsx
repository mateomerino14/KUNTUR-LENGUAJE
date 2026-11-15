import {noMoreInputMessage, type Diagnostic, type Position} from '../../../../../src/index.js';
import type {Execution} from '../../../hooks/useExecution';
import {DiagnosticItem} from '../molecules/DiagnosticItem';
import {InputBox} from '../molecules/InputBox';
import {Transcript} from '../molecules/Transcript';

interface OutputPanelProps {
  blocking: Diagnostic[];
  execution: Execution | null;
  input: string;
  showInput: boolean;
  onInputChange: (value: string) => void;
  onSelectPosition: (position: Position) => void;
}

const missingInputHint = 'Agrega una línea más en Entrada: cada leer() usa la siguiente.';

const styles = {
  panel: 'p-5 flex flex-col gap-5',
  heading: 'text-[17px] font-bold',
  hint: 'text-[16px] text-ink-muted max-w-[60ch] leading-relaxed',
  diagnostics: 'flex flex-col gap-3',
  modeNote: 'text-[14px] text-ink-muted',
};

export const OutputPanel = ({blocking, execution, input, showInput, onInputChange, onSelectPosition}: OutputPanelProps) => {
  const inputBox = showInput && <InputBox value={input} onChange={onInputChange} />;
  if (blocking.length > 0) {
    return (
      <section className={styles.panel}>
        {inputBox}
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
        {inputBox}
        <p className={styles.hint}>Presiona Ejecutar o Ctrl + Enter para ver lo que muestra el programa.</p>
        <p className={styles.hint}>
          La franja de colores de arriba es el camino que recorre tu código: léxico, sintaxis, semántica, WebAssembly y ejecución. Cada color se completa cuando su etapa termina bien y se vuelve rojo si encuentra un error. Haz clic en una etapa para ver lo que produjo.
        </p>
      </section>
    );
  }
  const missingInput = execution.diagnostics.some((diagnostic) => diagnostic.message === noMoreInputMessage);
  return (
    <section className={styles.panel} aria-live="polite">
      {inputBox}
      <p className={styles.modeNote}>
        {execution.mode === 'wasm' ? 'Ejecutado como WebAssembly' : 'Ejecutado con el intérprete'}
      </p>
      {execution.transcript.length > 0 && <Transcript entries={execution.transcript} />}
      {execution.transcript.length === 0 && execution.diagnostics.length === 0 && (
        <p className={styles.hint}>El programa terminó sin mostrar nada. Usa mostrar(...) para ver valores.</p>
      )}
      {execution.diagnostics.length > 0 && (
        <ul className={styles.diagnostics}>
          {execution.diagnostics.map((diagnostic, index) => (
            <DiagnosticItem key={index} diagnostic={diagnostic} onSelectPosition={onSelectPosition} />
          ))}
        </ul>
      )}
      {missingInput && <p className={styles.hint}>{missingInputHint}</p>}
    </section>
  );
};
