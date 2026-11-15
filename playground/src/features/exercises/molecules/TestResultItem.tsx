import {firstDifference, type Position, type TestResult} from '../../../../../src/index.js';
import {DiagnosticItem} from '../../output/molecules/DiagnosticItem';
import {IoBox} from './IoBox';

interface TestResultItemProps {
  result: TestResult;
  number: number;
  onSelectPosition: (position: Position) => void;
}

const styles = {
  item: 'flex flex-col gap-3 border-l-4 pl-4 py-2',
  passed: 'border-teal',
  failed: 'border-error',
  header: 'flex items-center gap-2 text-[15px] font-bold',
  icon: 'w-[18px] h-[18px] shrink-0',
  passedIcon: 'text-teal',
  failedIcon: 'text-error',
  hint: 'text-[15px] text-ink-muted max-w-[60ch] leading-relaxed',
  columns: 'grid gap-3 sm:grid-cols-3',
  diagnostics: 'flex flex-col gap-2',
};

const StatusIcon = ({passed}: {passed: boolean}) => (
  <svg className={`${styles.icon} ${passed ? styles.passedIcon : styles.failedIcon}`} viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <circle cx="9" cy="9" r="8" stroke="currentColor" strokeWidth="1.6" />
    {passed
      ? <path d="M5.5 9.2l2.3 2.3 4.7-4.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      : <path d="M6.2 6.2l5.6 5.6M11.8 6.2l-5.6 5.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
  </svg>
);

export const TestResultItem = ({result, number, onSelectPosition}: TestResultItemProps) => {
  const passed = result.outcome === 'passed';
  const visible = result.test.visible;
  const title = visible ? `Caso ${number}` : `Caso oculto ${number}`;
  const status = passed ? 'correcto' : 'no coincide';
  return (
    <li className={`${styles.item} ${passed ? styles.passed : styles.failed}`}>
      <span className={styles.header}>
        <StatusIcon passed={passed} />
        {title}: {status}
      </span>
      {!passed && result.outcome === 'runtime-error' && (
        <ul className={styles.diagnostics}>
          {result.diagnostics.map((diagnostic, index) => (
            <DiagnosticItem key={index} diagnostic={diagnostic} onSelectPosition={onSelectPosition} />
          ))}
        </ul>
      )}
      {!passed && visible && (
        <div className={styles.columns}>
          <IoBox title="Entrada" lines={result.test.input} emptyText="(sin entrada)" />
          <IoBox title="Salida esperada" lines={result.test.output} emptyText="(nada)" />
          <IoBox
            title="Tu programa mostró"
            lines={result.actual}
            emptyText="(nada)"
            highlight={firstDifference(result.test.output, result.actual)}
          />
        </div>
      )}
      {!passed && !visible && result.outcome === 'wrong-output' && (
        <p className={styles.hint}>
          Con otros datos tu programa muestra algo distinto. Revisa que el formato sea exactamente el del enunciado y prueba tu programa con otras entradas en Explorar.
        </p>
      )}
    </li>
  );
};
