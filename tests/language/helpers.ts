import {expect} from 'vitest';
import {runWasiModule} from '../../src/compiler/wasi/nodeRunner.js';
import {compile, formatDiagnostic, run, runCompiled, type ReadLine} from '../../src/index.js';

// Fuente de entrada que entrega las líneas indicadas en orden
const linesReader = (lines: string[]): ReadLine => {
  const pending = [...lines];
  return () => pending.shift() ?? null;
};

// Ejecuta en el intérprete, en WebAssembly para el navegador y en WebAssembly independiente, y exige el mismo resultado
export const expectSameEverywhere = async (source: string, input: string[] = []): Promise<string[]> => {
  const interpreted = run(source, {read: linesReader(input)});
  const compiled = await runCompiled(source, {read: linesReader(input)});
  expect(compiled).toEqual(interpreted);
  const {binary, diagnostics} = compile(source, {target: 'wasi'});
  expect(diagnostics).toEqual([]);
  const standalone = await runWasiModule(binary!, input.join('\n'));
  let expectedStderr = '';
  if (interpreted.diagnostics.length > 0) {
    expectedStderr = `${formatDiagnostic(interpreted.diagnostics[0])}\n`;
  }
  expect(standalone.stderr).toBe(expectedStderr);
  if (input.length === 0) {
    expect(standalone.stdout).toBe(interpreted.output.map((line) => `${line}\n`).join(''));
  }
  return interpreted.output;
};

// Devuelve los mensajes de error que encuentra el análisis antes de ejecutar
export const messagesOf = (source: string): string[] => run(source).diagnostics.map((diagnostic) => diagnostic.message);
