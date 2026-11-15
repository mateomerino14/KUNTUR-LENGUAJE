import type {Diagnostic, Position} from '../../../../../src/index.js';
import {STAGE_LABELS} from '../../../constants/stageLabels';

interface DiagnosticItemProps {
  diagnostic: Diagnostic;
  onSelectPosition: (position: Position) => void;
}

const styles = {
  item: 'border-l-4 pl-4 py-2',
  error: 'border-error',
  warning: 'border-violet',
  header: 'flex flex-wrap items-baseline gap-x-3 gap-y-1',
  stage: 'font-bold text-[14px]',
  position: 'text-[14px] text-blue underline underline-offset-2 cursor-pointer hover:text-ink',
  message: 'mt-1 text-[16px] leading-relaxed max-w-[68ch]',
};

export const DiagnosticItem = ({diagnostic, onSelectPosition}: DiagnosticItemProps) => {
  const {line, column} = diagnostic.position;
  return (
    <li className={`${styles.item} ${diagnostic.stage === 'compiler' ? styles.warning : styles.error}`}>
      <div className={styles.header}>
        <span className={styles.stage}>{STAGE_LABELS[diagnostic.stage]}</span>
        <button type="button" className={styles.position} onClick={() => onSelectPosition(diagnostic.position)}>
          Línea {line}, columna {column}
        </button>
      </div>
      <p className={styles.message}>{diagnostic.message}</p>
    </li>
  );
};
