import {useMemo} from 'react';
import type {Diagnostic, Position, Program, TypeInfo} from '../../../../../src/index.js';
import {toDisplayTree} from '../../../utils/astTree';
import {DiagnosticItem} from '../../output/molecules/DiagnosticItem';
import {TreeNode} from '../molecules/TreeNode';

interface TreePanelProps {
  program: Program | null;
  types: TypeInfo | null;
  diagnostics: Diagnostic[];
  onSelectPosition: (position: Position) => void;
}

const styles = {
  panel: 'p-5 flex flex-col gap-4',
  intro: 'text-[16px] text-ink-muted max-w-[62ch] leading-relaxed',
  diagnostics: 'flex flex-col gap-3',
  tree: 'text-[15px]',
};

export const TreePanel = ({program, types, diagnostics, onSelectPosition}: TreePanelProps) => {
  const tree = useMemo(() => (program ? toDisplayTree(program, types) : null), [program, types]);
  return (
    <section className={styles.panel}>
      <p className={styles.intro}>
        El analizador sintáctico arma este árbol con los tokens. Cada nodo dice qué papel cumple y, en verde, el tipo que dedujo el análisis semántico.
      </p>
      {diagnostics.length > 0 && (
        <ul className={styles.diagnostics}>
          {diagnostics.map((diagnostic, index) => (
            <DiagnosticItem key={index} diagnostic={diagnostic} onSelectPosition={onSelectPosition} />
          ))}
        </ul>
      )}
      {tree && (
        <ul className={styles.tree} aria-label="Árbol de sintaxis">
          <TreeNode node={tree} depth={0} onSelectPosition={onSelectPosition} />
        </ul>
      )}
    </section>
  );
};
