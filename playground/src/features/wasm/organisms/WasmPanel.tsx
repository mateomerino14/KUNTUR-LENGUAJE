import {useMemo, useState} from 'react';
import {compile, type CompileTarget, type Position} from '../../../../../src/index.js';
import {Button} from '../../../components/ui/Button';
import {SegmentedControl} from '../../../components/ui/SegmentedControl';
import type {Analysis} from '../../../hooks/useAnalysis';
import {plural} from '../../../utils/plural';
import {DiagnosticItem} from '../../output/molecules/DiagnosticItem';

interface WasmPanelProps {
  analysis: Analysis;
  blocked: boolean;
  onSelectPosition: (position: Position) => void;
}

const targetOptions: {value: CompileTarget; label: string}[] = [
  {value: 'browser', label: 'Para el navegador'},
  {value: 'wasi', label: 'Independiente (WASI)'},
];

const targetDescriptions: Record<CompileTarget, string> = {
  browser: 'Es el que usa el playground al ejecutar. Los números son f64 y los valores lógicos i32; los textos y las listas viven en JavaScript, que el módulo llama para mostrarlos o unirlos.',
  wasi: 'No necesita JavaScript: los textos y las listas viven en su propia memoria y habla con la terminal por WASI. Descárgalo y ejecútalo en cualquier computadora con wasmtime.',
};

const downloadName = 'programa.wasm';

const styles = {
  panel: 'p-5 flex flex-col gap-4',
  intro: 'text-[16px] text-ink-muted max-w-[62ch] leading-relaxed',
  heading: 'text-[17px] font-bold',
  diagnostics: 'flex flex-col gap-3',
  stats: 'flex flex-wrap items-center gap-x-6 gap-y-2',
  stat: 'text-[15px]',
  statValue: 'font-bold',
  command: 'font-mono text-[14px] bg-paper border border-line rounded-md px-3 py-2 w-fit',
  code: 'font-mono text-[14px] leading-[1.55] bg-paper border border-line rounded-md px-4 py-3 overflow-x-auto',
};

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
  const [target, setTarget] = useState<CompileTarget>('browser');
  const standalone = useMemo(() => {
    if (analysis.wasmBinary === null) {
      return null;
    }
    return compile(analysis.source, {target: 'wasi'});
  }, [analysis.source, analysis.wasmBinary]);

  if (blocked) {
    return (
      <section className={styles.panel}>
        <p className={styles.intro}>Corrige los errores del programa para ver cómo se compila a WebAssembly.</p>
      </section>
    );
  }
  if (analysis.wasmBinary === null || analysis.wasmText === null || standalone === null || standalone.binary === null || standalone.text === null) {
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
  const versions = {
    browser: {binary: analysis.wasmBinary, text: analysis.wasmText, importsLabel: 'de JavaScript'},
    wasi: {binary: standalone.binary, text: standalone.text, importsLabel: 'de WASI'},
  };
  const {binary, text, importsLabel} = versions[target];
  const download = standalone.binary;
  return (
    <section className={styles.panel}>
      <div>
        <SegmentedControl label="Versión del módulo" options={targetOptions} value={target} onChange={setTarget} />
      </div>
      <p className={styles.intro}>{targetDescriptions[target]}</p>
      <div className={styles.stats}>
        <span className={styles.stat}><span className={styles.statValue}>{plural(binary.length, 'byte', 'bytes')}</span> en binario</span>
        <span className={styles.stat}><span className={styles.statValue}>{plural(countLines(text, '(func '), 'función', 'funciones')}</span> en el módulo</span>
        <span className={styles.stat}><span className={styles.statValue}>{plural(countLines(text, '(import '), 'función', 'funciones')}</span> {importsLabel}</span>
        <Button onClick={() => downloadBinary(download)}>Descargar {downloadName}</Button>
      </div>
      <p className={styles.intro}>La descarga es la versión independiente. Para ejecutarla:</p>
      <code className={styles.command}>wasmtime {downloadName}</code>
      <pre className={styles.code}>{text}</pre>
    </section>
  );
};
