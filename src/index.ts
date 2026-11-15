import {checkProgram, type TypeInfo} from './checker/checker.js';
import {compileProgram} from './compiler/codegen.js';
import {runWasm} from './compiler/runner.js';
import {encodeModule} from './compiler/wasm/module.js';
import {moduleToText} from './compiler/wasm/text.js';
import type {Diagnostic} from './errors/diagnostic.js';
import {interpret} from './interpreter/interpreter.js';
import {tokenize} from './lexer/lexer.js';
import type {StepListener} from './interpreter/trace.js';
import type {Program} from './parser/ast.js';
import {parseTokens} from './parser/parser.js';

export {formatDiagnostic} from './errors/diagnostic.js';
export type {Diagnostic, Position, Stage} from './errors/diagnostic.js';
export {tokenize} from './lexer/lexer.js';
export {TokenType} from './lexer/token.js';
export type {Token} from './lexer/token.js';
export type * from './parser/ast.js';
export {printExpression} from './parser/printer.js';
export type {StepListener, StepSnapshot, TraceVariable} from './interpreter/trace.js';
export type {TypeInfo} from './checker/checker.js';
export type {Type} from './checker/types.js';
export {typeToString} from './checker/types.js';

export interface ParseSourceResult {
  program: Program | null;
  diagnostics: Diagnostic[];
}

export interface CheckSourceResult {
  program: Program | null;
  types: TypeInfo | null;
  diagnostics: Diagnostic[];
}

export interface CompileSourceOptions {
  maxSteps?: number;
}

export interface CompileSourceResult {
  binary: Uint8Array<ArrayBuffer> | null;
  text: string | null;
  diagnostics: Diagnostic[];
}

export interface RunOptions {
  write?: (line: string) => void;
  onStep?: StepListener;
  maxSteps?: number;
  random?: () => number;
}

export interface RunResult {
  output: string[];
  diagnostics: Diagnostic[];
}

// Analiza el código fuente hasta el árbol de sintaxis; si hay errores léxicos no sigue al parser
export const parse = (source: string): ParseSourceResult => {
  const lexed = tokenize(source);
  if (lexed.diagnostics.length > 0) {
    return {program: null, diagnostics: lexed.diagnostics};
  }
  const parsed = parseTokens(lexed.tokens);
  if (parsed.diagnostics.length > 0) {
    return {program: null, diagnostics: parsed.diagnostics};
  }
  return {program: parsed.program, diagnostics: []};
};

// Analiza el código fuente y revisa sus nombres y tipos, sin ejecutarlo
export const check = (source: string): CheckSourceResult => {
  const parsed = parse(source);
  if (parsed.program === null) {
    return {program: null, types: null, diagnostics: parsed.diagnostics};
  }
  const checked = checkProgram(parsed.program);
  if (checked.diagnostics.length > 0) {
    return {program: null, types: null, diagnostics: checked.diagnostics};
  }
  return {program: parsed.program, types: checked.types, diagnostics: []};
};

// Compila el código fuente a WebAssembly, en binario y en texto
export const compile = (source: string, options: CompileSourceOptions = {}): CompileSourceResult => {
  const checked = check(source);
  if (checked.program === null) {
    return {binary: null, text: null, diagnostics: checked.diagnostics};
  }
  const compiled = compileProgram(checked.program, checked.types!, options);
  if (compiled.module === null) {
    return {binary: null, text: null, diagnostics: compiled.diagnostics};
  }
  return {binary: encodeModule(compiled.module), text: moduleToText(compiled.module), diagnostics: []};
};

// Compila el código fuente a WebAssembly y lo ejecuta
export const runCompiled = async (source: string, options: RunOptions = {}): Promise<RunResult> => {
  const output: string[] = [];
  const compiled = compile(source, {maxSteps: options.maxSteps});
  if (compiled.binary === null) {
    return {output, diagnostics: compiled.diagnostics};
  }
  const write = (line: string): void => {
    output.push(line);
    options.write?.(line);
  };
  const diagnostics = await runWasm(compiled.binary, {write, maxSteps: options.maxSteps, random: options.random});
  return {output, diagnostics};
};

// Analiza, revisa y ejecuta el código fuente, devolviendo lo mostrado y los errores
export const run = (source: string, options: RunOptions = {}): RunResult => {
  const output: string[] = [];
  const checked = check(source);
  if (checked.program === null) {
    return {output, diagnostics: checked.diagnostics};
  }
  const write = (line: string): void => {
    output.push(line);
    options.write?.(line);
  };
  const result = interpret(checked.program, {write, maxSteps: options.maxSteps, random: options.random, onStep: options.onStep});
  return {output, diagnostics: result.diagnostics};
};
