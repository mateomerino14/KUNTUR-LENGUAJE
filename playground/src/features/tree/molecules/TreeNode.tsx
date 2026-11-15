import {useState} from 'react';
import type {Position} from '../../../../../src/index.js';
import type {DisplayNode} from '../../../utils/astTree';

interface TreeNodeProps {
  node: DisplayNode;
  depth: number;
  onSelectPosition: (position: Position) => void;
}

const initiallyOpenDepth = 3;

const styles = {
  item: 'list-none',
  row: 'flex items-baseline gap-2 py-[3px]',
  toggle: 'w-6 h-6 shrink-0 rounded text-ink-muted hover:bg-line hover:text-ink cursor-pointer font-mono',
  spacer: 'w-6 shrink-0',
  label: 'text-left cursor-pointer hover:underline underline-offset-2',
  role: 'text-ink-muted text-[14px]',
  name: 'font-bold',
  detail: 'font-mono text-[14px] text-fuchsia break-all',
  type: 'text-[13px] text-teal border border-teal rounded px-[6px] whitespace-nowrap',
  children: 'ml-3 pl-3 border-l-2 border-line',
};

export const TreeNode = ({node, depth, onSelectPosition}: TreeNodeProps) => {
  const [open, setOpen] = useState(depth < initiallyOpenDepth);
  const hasChildren = node.children.length > 0;
  return (
    <li className={styles.item}>
      <div className={styles.row}>
        {hasChildren ? (
          <button
            type="button"
            className={styles.toggle}
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-label={open ? `Cerrar ${node.label}` : `Abrir ${node.label}`}
          >
            {open ? '−' : '+'}
          </button>
        ) : (
          <span className={styles.spacer} />
        )}
        <button type="button" className={styles.label} onClick={() => node.position && onSelectPosition(node.position)}>
          {node.role && <span className={styles.role}>{node.role}: </span>}
          <span className={styles.name}>{node.label}</span>
          {node.detail && <span className={styles.detail}> {node.detail}</span>}
        </button>
        {node.typeLabel && <span className={styles.type}>{node.typeLabel}</span>}
      </div>
      {hasChildren && open && (
        <ul className={styles.children}>
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} onSelectPosition={onSelectPosition} />
          ))}
        </ul>
      )}
    </li>
  );
};
