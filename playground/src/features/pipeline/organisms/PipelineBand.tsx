import type {TabId} from '../../../constants/tabs';
import type {StageReport} from '../../../utils/stageReports';
import {STAGES, type StageId} from '../constants/stages';
import {StageStripe} from '../molecules/StageStripe';

interface PipelineBandProps {
  reports: Record<StageId, StageReport>;
  weaveKey: number;
  onSelectTab?: (tab: TabId) => void;
}

const styles = {
  band: 'flex overflow-x-auto bg-ink gap-[2px] border-y-2 border-ink',
};

export const PipelineBand = ({reports, weaveKey, onSelectTab}: PipelineBandProps) => (
  <nav className={styles.band} aria-label="Etapas del compilador">
    {STAGES.map((stage, order) => (
      <StageStripe
        key={stage.id}
        stage={stage}
        report={reports[stage.id]}
        order={order}
        weaveKey={weaveKey}
        onSelect={onSelectTab && (() => onSelectTab(stage.tab))}
      />
    ))}
  </nav>
);
