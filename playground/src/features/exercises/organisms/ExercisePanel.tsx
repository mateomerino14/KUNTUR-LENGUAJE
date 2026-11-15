import {EXERCISE_LEVELS, type Exercise, type GradeResult, type Position} from '../../../../../src/index.js';
import {Button} from '../../../components/ui/Button';
import {DiagnosticItem} from '../../output/molecules/DiagnosticItem';
import {IoBox} from '../molecules/IoBox';
import {RichText} from '../molecules/RichText';
import {TestResultItem} from '../molecules/TestResultItem';

interface ExercisePanelProps {
  exercise: Exercise;
  solved: boolean;
  grade: GradeResult | null;
  gradeIsStale: boolean;
  nextExercise: Exercise | null;
  onCheck: () => void;
  onRestart: () => void;
  onNext: (id: string) => void;
  onSelectPosition: (position: Position) => void;
}

const styles = {
  panel: 'p-5 flex flex-col gap-5 overflow-auto',
  header: 'flex flex-col gap-1',
  meta: 'flex items-center gap-3 text-[14px] text-ink-muted',
  solvedTag: 'text-teal font-bold',
  title: 'text-[24px] leading-tight font-bold',
  statement: 'flex flex-col gap-2 text-[16px] leading-relaxed max-w-[64ch]',
  examples: 'flex flex-col gap-3',
  sectionTitle: 'text-[16px] font-bold',
  example: 'grid gap-3 sm:grid-cols-2',
  actions: 'flex flex-wrap items-center gap-3',
  shortcut: 'font-normal text-[13px] opacity-80',
  hint: 'text-[15px] text-ink-muted max-w-[60ch] leading-relaxed',
  summary: 'text-[17px] font-bold',
  results: 'flex flex-col gap-3',
  diagnostics: 'flex flex-col gap-3',
  success: 'flex flex-col gap-3 bg-paper border border-teal rounded-md overflow-hidden',
  successEdge: 'h-[5px] bg-[linear-gradient(90deg,var(--color-fuchsia)_0_20%,var(--color-mustard)_20%_40%,var(--color-teal)_40%_60%,var(--color-violet)_60%_80%,var(--color-blue)_80%)]',
  successBody: 'flex flex-wrap items-center justify-between gap-3 px-4 pb-4',
  successText: 'text-[17px] font-bold text-teal',
};

const levelLabel = (exercise: Exercise) => EXERCISE_LEVELS.find((level) => level.id === exercise.level)?.label ?? '';

export const ExercisePanel = ({exercise, solved, grade, gradeIsStale, nextExercise, onCheck, onRestart, onNext, onSelectPosition}: ExercisePanelProps) => {
  const examples = exercise.tests.filter((test) => test.visible);
  const passedCount = grade?.results.filter((result) => result.outcome === 'passed').length ?? 0;
  return (
    <section className={styles.panel} aria-labelledby="titulo-ejercicio">
      <header className={styles.header}>
        <span className={styles.meta}>
          {levelLabel(exercise)}
          {solved && <span className={styles.solvedTag}>Resuelto</span>}
        </span>
        <h2 className={styles.title} id="titulo-ejercicio">{exercise.title}</h2>
      </header>
      <div className={styles.statement}>
        {exercise.statement.map((paragraph, index) => <p key={index}><RichText text={paragraph} /></p>)}
      </div>
      <div className={styles.examples}>
        <h3 className={styles.sectionTitle}>{examples.length === 1 ? 'Ejemplo' : 'Ejemplos'}</h3>
        {examples.map((test, index) => (
          <div key={index} className={styles.example}>
            <IoBox title="Entrada, una línea por cada leer()" lines={test.input} emptyText="(sin entrada)" />
            <IoBox title="Salida esperada" lines={test.output} emptyText="(nada)" />
          </div>
        ))}
      </div>
      <div className={styles.actions}>
        <Button variant="primary" onClick={onCheck}>
          Comprobar <span className={styles.shortcut}>Ctrl + Enter</span>
        </Button>
        <Button onClick={onRestart}>Volver al código inicial</Button>
      </div>
      <div aria-live="polite" className={styles.results}>
        {grade === null && !gradeIsStale && (
          <p className={styles.hint}>
            Escribe tu solución en el editor y presiona Comprobar. Se probará con los ejemplos y con otros casos que no se muestran.
          </p>
        )}
        {gradeIsStale && <p className={styles.hint}>Cambiaste el código. Presiona Comprobar para volver a probarlo.</p>}
        {grade !== null && grade.blocking.length > 0 && (
          <>
            <h3 className={styles.summary}>Corrige esto antes de comprobar</h3>
            <ul className={styles.diagnostics}>
              {grade.blocking.map((diagnostic, index) => (
                <DiagnosticItem key={index} diagnostic={diagnostic} onSelectPosition={onSelectPosition} />
              ))}
            </ul>
          </>
        )}
        {grade !== null && grade.solved && (
          <div className={styles.success}>
            <div className={styles.successEdge} />
            <div className={styles.successBody}>
              <span className={styles.successText}>¡Resuelto! Pasaste los {grade.results.length} casos.</span>
              {nextExercise && <Button variant="primary" onClick={() => onNext(nextExercise.id)}>Siguiente: {nextExercise.title}</Button>}
            </div>
          </div>
        )}
        {grade !== null && grade.blocking.length === 0 && !grade.solved && (
          <h3 className={styles.summary}>{passedCount} de {grade.results.length} casos correctos</h3>
        )}
        {grade !== null && grade.results.length > 0 && (
          <ul className={styles.results}>
            {grade.results.map((result, index) => (
              <TestResultItem key={index} result={result} number={index + 1} onSelectPosition={onSelectPosition} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};
