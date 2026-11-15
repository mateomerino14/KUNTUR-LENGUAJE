#!/usr/bin/env node
import {readFileSync, writeFileSync} from 'node:fs';
import {compile, formatDiagnostic, parse, run, runCompiled, tokenize, type Diagnostic} from './index.js';
import {createStdinReader} from './stdinReader.js';

const usage = [
  'Uso:',
  '  kuntur <archivo.kun>            Ejecuta el programa',
  '  kuntur --tokens <archivo.kun>   Muestra los tokens del analizador léxico',
  '  kuntur --arbol <archivo.kun>    Muestra el árbol de sintaxis',
  '  kuntur --wasm <archivo.kun>     Compila a WebAssembly y ejecuta el resultado',
  '  kuntur --wat <archivo.kun>      Muestra el WebAssembly generado, en formato de texto',
  '  kuntur --wasi <archivo.kun>     Compila a un WebAssembly independiente (WASI) y lo ejecuta',
  '  kuntur --compilar <archivo.kun> <salida.wasm>   Guarda un WebAssembly independiente, que corre con wasmtime',
].join('\n');

const errorExitCode = 1;
const jsonIndent = 2;

// Lee el archivo indicado o termina con un mensaje si no existe
const readSource = (path: string): string => {
  try {
    return readFileSync(path, 'utf8');
  }
  catch {
    process.stderr.write(`No se pudo leer el archivo \`${path}\`.\n`);
    process.exit(errorExitCode);
  }
};

// Muestra los errores con la línea del código y termina con código de error
const reportAndExit = (diagnostics: Diagnostic[], source: string): never => {
  const formatted = diagnostics.map((diagnostic) => formatDiagnostic(diagnostic, source));
  process.stderr.write(`${formatted.join('\n\n')}\n`);
  process.exit(errorExitCode);
};

// Imprime cada token con su posición y su tipo
const printTokens = (source: string): void => {
  const {tokens, diagnostics} = tokenize(source);
  for (const token of tokens) {
    const position = `${token.position.line}:${token.position.column}`.padEnd(8);
    process.stdout.write(`${position}${token.type.padEnd(14)}${JSON.stringify(token.lexeme)}\n`);
  }
  if (diagnostics.length > 0) {
    reportAndExit(diagnostics, source);
  }
};

// Imprime el árbol de sintaxis sin las posiciones, para que se lea mejor
const printTree = (source: string): void => {
  const {program, diagnostics} = parse(source);
  if (program === null) {
    reportAndExit(diagnostics, source);
  }
  const withoutPositions = (key: string, value: unknown): unknown => {
    if (key === 'position') {
      return undefined;
    }
    return value;
  };
  process.stdout.write(`${JSON.stringify(program, withoutPositions, jsonIndent)}\n`);
};

// Ejecuta el programa mostrando la salida a medida que se produce
const runFile = (source: string): void => {
  const {diagnostics} = run(source, {write: (line) => process.stdout.write(`${line}\n`), read: createStdinReader(process.stdout)});
  if (diagnostics.length > 0) {
    reportAndExit(diagnostics, source);
  }
};

// Compila a WebAssembly y ejecuta el módulo, mostrando la salida a medida que se produce
const runWasmFile = async (source: string): Promise<void> => {
  const {diagnostics} = await runCompiled(source, {
    write: (line) => process.stdout.write(`${line}\n`),
    read: createStdinReader(process.stdout),
  });
  if (diagnostics.length > 0) {
    reportAndExit(diagnostics, source);
  }
};

// Imprime el módulo de WebAssembly en formato de texto
const printWat = (source: string): void => {
  const {text, diagnostics} = compile(source);
  if (text === null) {
    reportAndExit(diagnostics, source);
  }
  process.stdout.write(`${text}\n`);
};

// Guarda el WebAssembly independiente en el archivo indicado
const writeWasm = (source: string, outputPath: string): void => {
  const {binary, diagnostics} = compile(source, {target: 'wasi'});
  if (binary === null) {
    return reportAndExit(diagnostics, source);
  }
  writeFileSync(outputPath, binary);
  process.stdout.write(`Se guardó \`${outputPath}\` (${binary.length} bytes). Ejecútalo con: wasmtime ${outputPath}\n`);
};

// Compila a WebAssembly independiente y lo ejecuta con el WASI de Node, usando la terminal como entrada y salida
const runWasiFile = async (source: string): Promise<void> => {
  const {binary, diagnostics} = compile(source, {target: 'wasi'});
  if (binary === null) {
    return reportAndExit(diagnostics, source);
  }
  // Node avisa que su WASI es experimental; el aviso no le sirve a quien ejecuta un programa
  process.removeAllListeners('warning');
  const {WASI} = await import('node:wasi');
  const wasi = new WASI({version: 'preview1', returnOnExit: true});
  const {instance} = await WebAssembly.instantiate(binary, wasi.getImportObject() as WebAssembly.Imports);
  process.exitCode = wasi.start(instance);
};

// Termina sin error si quien lee la salida la cierra antes, por ejemplo con `| head`
const exitOnClosedOutput = (error: NodeJS.ErrnoException): void => {
  if (error.code === 'EPIPE') {
    process.exit(0);
  }
  throw error;
};

// Interpreta los argumentos de la línea de comandos
const main = async (args: string[]): Promise<void> => {
  if (args.length === 1 && !args[0].startsWith('--')) {
    runFile(readSource(args[0]));
    return;
  }
  if (args.length === 2 && args[0] === '--tokens') {
    printTokens(readSource(args[1]));
    return;
  }
  if (args.length === 2 && args[0] === '--arbol') {
    printTree(readSource(args[1]));
    return;
  }
  if (args.length === 2 && args[0] === '--wasm') {
    await runWasmFile(readSource(args[1]));
    return;
  }
  if (args.length === 2 && args[0] === '--wasi') {
    await runWasiFile(readSource(args[1]));
    return;
  }
  if (args.length === 2 && args[0] === '--wat') {
    printWat(readSource(args[1]));
    return;
  }
  if (args.length === 3 && args[0] === '--compilar') {
    writeWasm(readSource(args[1]), args[2]);
    return;
  }
  process.stderr.write(`${usage}\n`);
  process.exit(errorExitCode);
};

process.stdout.on('error', exitOnClosedOutput);
await main(process.argv.slice(2));
