import {checkProgram, type TypeInfo} from './checker/checker.js';
import {compileProgram, type CompileTarget} from './compiler/codegen.js';
import {runWasm} from './compiler/runner.js';
import {encodeModule} from './compiler/wasm/module.js';
import {moduleToText} from './compiler/wasm/text.js';
import type {Diagnostic} from './errors/diagnostic.js';
import {interpret} from './interpreter/interpreter.js';
import {localizeMessage, type Language} from './language/quechua.js';
import {tokenize} from './lexer/lexer.js';
import type {ReadLine} from './interpreter/builtins.js';
import type {StepListener} from './interpreter/trace.js';
import type {Program} from './parser/ast.js';
import {parseTokens} from './parser/parser.js';

export {formatDiagnostic} from './errors/diagnostic.js';
export {noMoreInputMessage} from './errors/messages.js';
export type {CompileTarget} from './compiler/codegen.js';
export {EXERCISE_LEVELS, EXERCISES} from './exercises/catalog.js';
export type {Exercise, ExerciseLevel, TestCase} from './exercises/catalog.js';
export {firstDifference, gradeExercise} from './exercises/grader.js';
export type {GradeResult, TestOutcome, TestResult} from './exercises/grader.js';
export type {Diagnostic, Position, Stage} from './errors/diagnostic.js';
export {tokenize} from './lexer/lexer.js';
export {TokenType} from './lexer/token.js';
export type {Token} from './lexer/token.js';
export type * from './parser/ast.js';
export {printExpression} from './parser/printer.js';
export type {StepListener, StepSnapshot, TraceVariable} from './interpreter/trace.js';
export type {ReadLine} from './interpreter/builtins.js';
export type {TypeInfo} from './checker/checker.js';
export type {Type} from './checker/types.js';
export {typeToString} from './checker/types.js';
export {LANGUAGES, localizeMessage, QUECHUA_WORDS, toQuechua} from './language/quechua.js';
export type {Language} from './language/quechua.js';
export {translateSource} from './language/translate.js';

export interface SourceOptions {
  language?: Language;
}

export interface ParseSourceResult {
  program: Program | null;
  diagnostics: Diagnostic[];
}

export interface CheckSourceResult {
  program: Program | null;
  types: TypeInfo | null;
  diagnostics: Diagnostic[];
}

export interface CompileSourceOptions extends SourceOptions {
  maxSteps?: number;
  target?: CompileTarget;
}

export interface CompileSourceResult {
  binary: Uint8Array<ArrayBuffer> | null;
  text: string | null;
  diagnostics: Diagnostic[];
}

export interface RunOptions extends SourceOptions {
  write?: (line: string) => void;
  onStep?: StepListener;
  maxSteps?: number;
  random?: () => number;
  read?: ReadLine;
}

export interface RunResult {
  output: string[];
  diagnostics: Diagnostic[];
}

// Pasa al idioma del programa las palabras del lenguaje que mencionan los errores
const localize = (diagnostics: Diagnostic[], language: Language | undefined): Diagnostic[] => {
  if (language === undefined || language === 'es') {
    return diagnostics;
  }
  return diagnostics.map((diagnostic) => ({...diagnostic, message: localizeMessage(diagnostic.message, language)}));
};

// Analiza el código fuente hasta el árbol de sintaxis; si hay errores léxicos no sigue al parser
export const parse = (source: string, options: SourceOptions = {}): ParseSourceResult => {
  const lexed = tokenize(source, options.language);
  if (lexed.diagnostics.length > 0) {
    return {program: null, diagnostics: lexed.diagnostics};
  }
  const parsed = parseTokens(lexed.tokens);
  if (parsed.diagnostics.length > 0) {
    return {program: null, diagnostics: localize(parsed.diagnostics, options.language)};
  }
  return {program: parsed.program, diagnostics: []};
};

// Analiza el código fuente y revisa sus nombres y tipos, sin ejecutarlo
export const check = (source: string, options: SourceOptions = {}): CheckSourceResult => {
  const parsed = parse(source, options);
  if (parsed.program === null) {
    return {program: null, types: null, diagnostics: parsed.diagnostics};
  }
  const checked = checkProgram(parsed.program);
  if (checked.diagnostics.length > 0) {
    return {program: null, types: null, diagnostics: localize(checked.diagnostics, options.language)};
  }
  return {program: parsed.program, types: checked.types, diagnostics: []};
};

// Compila el código fuente a WebAssembly, en binario y en texto
export const compile = (source: string, options: CompileSourceOptions = {}): CompileSourceResult => {
  const checked = check(source, options);
  if (checked.program === null) {
    return {binary: null, text: null, diagnostics: checked.diagnostics};
  }
  const compiled = compileProgram(checked.program, checked.types!, options);
  if (compiled.module === null) {
    return {binary: null, text: null, diagnostics: localize(compiled.diagnostics, options.language)};
  }
  return {binary: encodeModule(compiled.module), text: moduleToText(compiled.module), diagnostics: []};
};

// Compila el código fuente a WebAssembly y lo ejecuta
export const runCompiled = async (source: string, options: RunOptions = {}): Promise<RunResult> => {
  const output: string[] = [];
  const compiled = compile(source, {maxSteps: options.maxSteps, language: options.language});
  if (compiled.binary === null) {
    return {output, diagnostics: compiled.diagnostics};
  }
  const write = (line: string): void => {
    output.push(line);
    options.write?.(line);
  };
  const diagnostics = await runWasm(compiled.binary, {write, maxSteps: options.maxSteps, random: options.random, read: options.read});
  return {output, diagnostics: localize(diagnostics, options.language)};
};

// Analiza, revisa y ejecuta el código fuente, devolviendo lo mostrado y los errores
export const run = (source: string, options: RunOptions = {}): RunResult => {
  const output: string[] = [];
  const checked = check(source, options);
  if (checked.program === null) {
    return {output, diagnostics: checked.diagnostics};
  }
  const write = (line: string): void => {
    output.push(line);
    options.write?.(line);
  };
  const result = interpret(checked.program, {
    write,
    maxSteps: options.maxSteps,
    random: options.random,
    read: options.read,
    onStep: options.onStep,
  });
  return {output, diagnostics: localize(result.diagnostics, options.language)};
};
