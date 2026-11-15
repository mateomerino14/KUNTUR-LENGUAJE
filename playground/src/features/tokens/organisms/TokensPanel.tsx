import type {Diagnostic, Position, Token} from '../../../../../src/index.js';
import {DiagnosticItem} from '../../output/molecules/DiagnosticItem';
import {tokenLabel, tokenText} from '../constants/tokenLabels';

interface TokensPanelProps {
  tokens: Token[];
  diagnostics: Diagnostic[];
  onSelectPosition: (position: Position) => void;
}

const styles = {
  panel: 'p-5 flex flex-col gap-4',
  intro: 'text-[16px] text-ink-muted max-w-[62ch] leading-relaxed',
  diagnostics: 'flex flex-col gap-3',
  table: 'w-full border-collapse text-[15px]',
  equivalent: 'font-normal text-ink-muted',
  head: 'text-left text-ink-muted font-bold border-b border-line',
  headCell: 'py-2 pr-4 font-bold',
  row: 'border-b border-line hover:bg-paper cursor-pointer',
  cell: 'py-[6px] pr-4 align-top',
  position: 'font-mono text-ink-muted whitespace-nowrap',
  lexeme: 'font-mono font-bold break-all',
};

export const TokensPanel = ({tokens, diagnostics, onSelectPosition}: TokensPanelProps) => (
  <section className={styles.panel}>
    <p className={styles.intro}>
      El analizador léxico corta el texto en tokens: las piezas mínimas del lenguaje. Elige una fila para verla en el código.
    </p>
    {diagnostics.length > 0 && (
      <ul className={styles.diagnostics}>
        {diagnostics.map((diagnostic, index) => (
          <DiagnosticItem key={index} diagnostic={diagnostic} onSelectPosition={onSelectPosition} />
        ))}
      </ul>
    )}
    <table className={styles.table}>
      <thead className={styles.head}>
        <tr>
          <th className={styles.headCell} scope="col">Lugar</th>
          <th className={styles.headCell} scope="col">Clase</th>
          <th className={styles.headCell} scope="col">Texto</th>
        </tr>
      </thead>
      <tbody>
        {tokens.map((token, index) => (
          <tr
            key={index}
            className={styles.row}
            tabIndex={0}
            onClick={() => onSelectPosition(token.position)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                onSelectPosition(token.position);
              }
            }}
          >
            <td className={`${styles.cell} ${styles.position}`}>{token.position.line}:{token.position.column}</td>
            <td className={styles.cell}>{tokenLabel(token.type)}</td>
            <td className={`${styles.cell} ${styles.lexeme}`}>
              {tokenText(token.original ?? token.lexeme, token.type)}
              {token.original !== undefined && <span className={styles.equivalent}> = {token.lexeme}</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </section>
);
