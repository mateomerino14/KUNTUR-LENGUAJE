import type {StageDefinition} from '../constants/stages';
import type {StageReport} from '../../../utils/stageReports';

interface StageStripeProps {
  stage: StageDefinition;
  report: StageReport;
  order: number;
  weaveKey: number;
  onSelect?: () => void;
}

const weaveDelayMs = 70;

const styles = {
  button: 'relative flex-1 min-w-[150px] text-left overflow-hidden cursor-pointer focus-visible:z-10',
  static: 'relative flex-1 min-w-[150px] overflow-hidden',
  woven: 'aguayo aguayo-weave h-full px-5 py-[18px]',
  plain: 'h-full px-5 py-[18px] border-y-4',
  pending: 'bg-salt border-line text-ink-muted',
  warning: 'bg-paper border-violet text-ink',
  name: 'block font-bold text-[18px] leading-tight',
  summary: 'block text-[14px] leading-tight mt-1',
};

export const StageStripe = ({stage, report, order, weaveKey, onSelect}: StageStripeProps) => {
  const woven = report.status === 'ok' || report.status === 'error';
  const fill = report.status === 'error' ? 'bg-error text-paper [--stripe:var(--color-ink)]' : `${stage.colorClass} ${stage.textClass} ${stage.stripeClass}`;
  const plain = report.status === 'warning' ? styles.warning : styles.pending;
  const content = (
    <span
      key={weaveKey}
      className={woven ? `${styles.woven} ${fill}` : `${styles.plain} ${plain}`}
      style={{['--weave-delay' as string]: `${order * weaveDelayMs}ms`, display: 'block'}}
    >
      <span className={styles.name}>{stage.name}</span>
      <span className={styles.summary}>{report.summary}</span>
    </span>
  );
  if (onSelect === undefined) {
    return <div className={styles.static}>{content}</div>;
  }
  return (
    <button
      type="button"
      className={styles.button}
      onClick={onSelect}
      aria-label={`${stage.name}: ${report.summary}. Ver detalle.`}
    >
      {content}
    </button>
  );
};
