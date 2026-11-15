import {Button} from '../../../components/ui/Button';
import {MAX_TRACE_STEPS} from '../../../constants/limits';
import type {Execution} from '../../../hooks/useExecution';
import {VariableList} from '../molecules/VariableList';

interface StepperPanelProps {
  execution: Execution | null;
  stepIndex: number;
  onStepChange: (index: number) => void;
  onRunStepper: () => void;
  blocked: boolean;
}

const styles = {
  panel: 'p-5 flex flex-col gap-5',
  intro: 'text-[16px] text-ink-muted max-w-[62ch] leading-relaxed',
  controls: 'flex flex-wrap items-center gap-3',
  slider: 'flex-1 min-w-[160px] accent-ink',
  counter: 'text-[15px] whitespace-nowrap',
  note: 'text-[14px] text-ink-muted',
  section: 'flex flex-col gap-2',
  title: 'text-[15px] font-bold',
  stack: 'flex flex-wrap gap-2',
  frame: 'px-3 py-1 rounded-md border border-line bg-paper font-mono text-[14px]',
  currentFrame: 'px-3 py-1 rounded-md bg-ink text-paper font-mono text-[14px] font-bold',
  output: 'font-mono text-[14px] leading-[1.6] whitespace-pre-wrap bg-paper border border-line rounded-md px-3 py-2 min-h-[2.5rem]',
  variables: 'grid gap-4 sm:grid-cols-2',
};

export const StepperPanel = ({execution, stepIndex, onStepChange, onRunStepper, blocked}: StepperPanelProps) => {
  if (execution === null || execution.trace.length === 0) {
    return (
      <section className={styles.panel}>
        <p className={styles.intro}>
          Recorre el programa una sentencia a la vez: la línea actual se marca en el editor y aquí ves la pila de llamadas y el valor de cada variable.
        </p>
        <div>
          <Button variant="primary" onClick={onRunStepper} disabled={blocked}>Ejecutar paso a paso</Button>
        </div>
      </section>
    );
  }
  const step = execution.trace[stepIndex];
  const last = execution.trace.length - 1;
  const outputSoFar = execution.output.slice(0, step.outputLength);
  const stack = step.snapshot.callStack;
  return (
    <section className={styles.panel}>
      <div className={styles.controls}>
        <Button onClick={() => onStepChange(stepIndex - 1)} disabled={stepIndex === 0}>Anterior</Button>
        <Button variant="primary" onClick={() => onStepChange(stepIndex + 1)} disabled={stepIndex === last}>Siguiente</Button>
        <input
          className={styles.slider}
          type="range"
          min={0}
          max={last}
          value={stepIndex}
          onChange={(event) => onStepChange(Number(event.target.value))}
          aria-label="Paso de la ejecución"
        />
        <span className={styles.counter}>Paso {stepIndex + 1} de {execution.trace.length}, línea {step.position.line}</span>
      </div>
      {execution.traceTruncated && (
        <p className={styles.note}>Se guardaron los primeros {MAX_TRACE_STEPS} pasos; el programa siguió hasta el final.</p>
      )}
      <div className={styles.section}>
        <h3 className={styles.title}>Pila de llamadas</h3>
        <ol className={styles.stack} aria-label="De la llamada más externa a la actual">
          {stack.map((frame, index) => (
            <li key={index} className={index === stack.length - 1 ? styles.currentFrame : styles.frame}>{frame}</li>
          ))}
        </ol>
      </div>
      <div className={styles.variables}>
        <VariableList title="En este bloque" variables={step.snapshot.locals} emptyText="Todavía no hay variables locales." />
        <VariableList title="Del programa" variables={step.snapshot.globals} emptyText="Todavía no hay variables globales." />
      </div>
      <div className={styles.section}>
        <h3 className={styles.title}>Lo mostrado hasta aquí</h3>
        <pre className={styles.output}>{outputSoFar.join('\n')}</pre>
      </div>
    </section>
  );
};
