import {GroupedPicker} from '../../../components/ui/GroupedPicker';
import {EXAMPLE_GROUPS, EXAMPLES} from '../../../constants/examples';

interface ExamplePickerProps {
  value: string;
  onSelect: (id: string) => void;
}

export const ExamplePicker = ({value, onSelect}: ExamplePickerProps) => (
  <GroupedPicker
    idPrefix="ejemplo"
    label="Ejemplo"
    emptyLabel="Tu programa"
    groups={EXAMPLE_GROUPS}
    items={EXAMPLES}
    value={value}
    onSelect={onSelect}
  />
);
