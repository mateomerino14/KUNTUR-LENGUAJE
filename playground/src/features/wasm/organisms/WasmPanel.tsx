import type {Position} from '../../../../../src/index.js';
import {Button} from '../../../components/ui/Button';
import type {Analysis} from '../../../hooks/useAnalysis';
import {plural} from '../../../utils/plural';
import {DiagnosticItem} from '../../output/molecules/DiagnosticItem';

interface WasmPanelProps {
  analysis: Analysis;
  blocked: boolean;
  onSelectPosition: (position: Position) => void;
}

const styles = {
  panel: 'p-5 flex flex-col gap-4',
  intro: 'text-[16px] text-ink-muted max-w-[62ch] leading-relaxed',
  heading: 'text-[17px] font-bold',
  diagnostics: 'flex flex-col gap-3',
  stats: 'flex flex-wrap items-center gap-x-6 gap-y-2',
  stat: 'text-[15px]',
  statValue: 'font-bold',
  code: 'font-mono text-[14px] leading-[1.55] bg-paper border border-line rounded-md px-4 py-3 overflow-x-auto',
};

const downloadName = 'programa.wasm';

// Descarga el binario con el nombre indicado
const downloadBinary = (binary: Uint8Array<ArrayBuffer>) => {
  const url = URL.createObjectURL(new Blob([binary], {type: 'application/wasm'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = downloadName;
  link.click();
  URL.revokeObjectURL(url);
};

// Cuenta las líneas del texto que empiezan con el prefijo indicado
const countLines = (text: string, prefix: string) => text.split('\n').filter((line) => line.trimStart().startsWith(prefix)).length;

export const WasmPanel = ({analysis, blocked, onSelectPosition}: WasmPanelProps) => {
  if (blocked) {
    return (
      <section className={styles.panel}>
        <p className={styles.intro}>Corrige los errores del programa para ver cómo se compila a WebAssembly.</p>
      </section>
    );
  }
  if (analysis.wasmBinary === null || analysis.wasmText === null) {
    return (
      <section className={styles.panel}>
        <h2 className={styles.heading}>El intérprete puede ejecutarlo, pero para compilarlo falta esto</h2>
        <ul className={styles.diagnostics}>
          {analysis.compilerDiagnostics.map((diagnostic, index) => (
            <DiagnosticItem key={index} diagnostic={diagnostic} onSelectPosition={onSelectPosition} />
          ))}
        </ul>
      </section>
    );
  }
  const binary = analysis.wasmBinary;
  return (
    <section className={styles.panel}>
      <p className={styles.intro}>
        Este es el módulo de WebAssembly que genera el compilador, en su formato de texto. Los números son f64, los valores lógicos i32 y los textos y listas, referencias a JavaScript.
      </p>
      <div className={styles.stats}>
        <span className={styles.stat}><span className={styles.statValue}>{plural(binary.length, 'byte', 'bytes')}</span> en binario</span>
        <span className={styles.stat}><span className={styles.statValue}>{plural(countLines(analysis.wasmText, '(func '), 'función', 'funciones')}</span> en el módulo</span>
        <span className={styles.stat}><span className={styles.statValue}>{plural(countLines(analysis.wasmText, '(import '), 'función', 'funciones')}</span> del anfitrión</span>
        <Button onClick={() => downloadBinary(binary)}>Descargar {downloadName}</Button>
      </div>
      <pre className={styles.code}>{analysis.wasmText}</pre>
    </section>
  );
};
