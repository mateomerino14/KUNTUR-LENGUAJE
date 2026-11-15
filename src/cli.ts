#!/usr/bin/env node
import {readFileSync} from 'node:fs';
import {formatDiagnostic, parse, run, tokenize, type Diagnostic} from './index.js';

const usage = [
  'Uso:',
  '  kuntur <archivo.kun>            Ejecuta el programa',
  '  kuntur --tokens <archivo.kun>   Muestra los tokens del analizador léxico',
  '  kuntur --arbol <archivo.kun>    Muestra el árbol de sintaxis',
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
  const {diagnostics} = run(source, {write: (line) => process.stdout.write(`${line}\n`)});
  if (diagnostics.length > 0) {
    reportAndExit(diagnostics, source);
  }
};

// Termina sin error si quien lee la salida la cierra antes, por ejemplo con `| head`
const exitOnClosedOutput = (error: NodeJS.ErrnoException): void => {
  if (error.code === 'EPIPE') {
    process.exit(0);
  }
  throw error;
};

// Interpreta los argumentos de la línea de comandos
const main = (args: string[]): void => {
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
  process.stderr.write(`${usage}\n`);
  process.exit(errorExitCode);
};

process.stdout.on('error', exitOnClosedOutput);
main(process.argv.slice(2));
