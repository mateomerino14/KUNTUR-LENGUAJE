import type {Position} from '../errors/diagnostic.js';
import {divisionByZeroMessage, tooDeepMessage, tooManyStepsMessage, zeroStepMessage} from '../errors/messages.js';
import {createBuiltins} from '../interpreter/builtins.js';
import {checkIndex} from '../interpreter/indexing.js';
import {RuntimeError} from '../interpreter/runtimeError.js';
import {stringify, valuesEqual, type NativeFunction, type Value} from '../interpreter/values.js';
import type {FunctionSignature} from './wasm/module.js';

export const hostModuleName = 'kuntur';

const ext = 'externref';

export const hostSignatures = {
  line_start: {params: [], results: []},
  append_number: {params: ['f64'], results: []},
  append_bool: {params: ['i32'], results: []},
  append_ref: {params: [ext], results: []},
  line_end: {params: [], results: []},
  text_literal: {params: ['i32', 'i32'], results: [ext]},
  text_concat: {params: [ext, ext], results: [ext]},
  number_to_text: {params: ['f64'], results: [ext]},
  bool_to_text: {params: ['i32'], results: [ext]},
  ref_to_text: {params: [ext], results: [ext]},
  text_compare: {params: [ext, ext], results: ['i32']},
  values_equal: {params: [ext, ext], results: ['i32']},
  length: {params: [ext], results: ['f64']},
  text_at: {params: [ext, 'f64', 'i32', 'i32'], results: [ext]},
  parse_number: {params: [ext, 'i32', 'i32'], results: ['f64']},
  list_new: {params: [], results: [ext]},
  list_push: {params: [ext, ext], results: []},
  list_get: {params: [ext, 'f64', 'i32', 'i32'], results: [ext]},
  list_set: {params: [ext, 'f64', ext, 'i32', 'i32'], results: []},
  list_pop: {params: [ext, 'i32', 'i32'], results: [ext]},
  list_concat: {params: [ext, ext], results: [ext]},
  box_number: {params: ['f64'], results: [ext]},
  unbox_number: {params: [ext], results: ['f64']},
  box_bool: {params: ['i32'], results: [ext]},
  unbox_bool: {params: [ext], results: ['i32']},
  random_int: {params: ['f64', 'f64', 'i32', 'i32'], results: ['f64']},
  square_root: {params: ['f64', 'i32', 'i32'], results: ['f64']},
  fail_division_by_zero: {params: ['i32', 'i32'], results: []},
  fail_zero_step: {params: ['i32', 'i32'], results: []},
  fail_too_many_steps: {params: ['i32', 'i32'], results: []},
  fail_too_deep: {params: [ext, 'i32', 'i32'], results: []},
} satisfies Record<string, FunctionSignature>;

export type HostFunctionName = keyof typeof hostSignatures;

export interface HostOptions {
  write: (line: string) => void;
  random: () => number;
  maxSteps: number;
  memory: () => WebAssembly.Memory;
}

type HostFunction = (...args: never[]) => unknown;

const textDecoder = new TextDecoder();

// Arma la posición a partir de la línea y la columna que pasa el código compilado
const at = (line: number, column: number): Position => ({line, column});

// Convierte el resultado lógico de JavaScript en el entero que usa WebAssembly
const toFlag = (value: boolean): number => {
  if (value) {
    return 1;
  }
  return 0;
};

// Crea las funciones de JavaScript que importa el código compilado, con los mismos mensajes que el intérprete
export const createHostFunctions = (options: HostOptions): Record<HostFunctionName, HostFunction> => {
  const builtins = new Map<string, NativeFunction>();
  for (const builtin of createBuiltins({write: options.write, random: options.random})) {
    builtins.set(builtin.name, builtin);
  }
  // Llama a una función propia del intérprete para reutilizar su comportamiento y sus errores
  const callBuiltin = (name: string, args: Value[], position: Position): Value => builtins.get(name)!.call(args, position);
  const lines: string[][] = [];
  const literals = new Map<number, string>();
  return {
    line_start: () => {
      lines.push([]);
    },
    append_number: (value: number) => {
      lines.at(-1)!.push(stringify(value));
    },
    append_bool: (value: number) => {
      lines.at(-1)!.push(stringify(value !== 0));
    },
    append_ref: (value: Value) => {
      lines.at(-1)!.push(stringify(value));
    },
    line_end: () => {
      options.write(lines.pop()!.join(' '));
    },
    text_literal: (offset: number, length: number) => {
      let text = literals.get(offset);
      if (text === undefined) {
        text = textDecoder.decode(new Uint8Array(options.memory().buffer, offset, length));
        literals.set(offset, text);
      }
      return text;
    },
    text_concat: (left: string, right: string) => left + right,
    number_to_text: (value: number) => stringify(value),
    bool_to_text: (value: number) => stringify(value !== 0),
    ref_to_text: (value: Value) => stringify(value),
    text_compare: (left: string, right: string) => {
      if (left < right) {
        return -1;
      }
      if (left > right) {
        return 1;
      }
      return 0;
    },
    values_equal: (left: Value, right: Value) => toFlag(valuesEqual(left, right)),
    length: (value: Value) => callBuiltin('longitud', [value], at(0, 0)),
    text_at: (text: string, index: number, line: number, column: number) => text[checkIndex(index, text.length, at(line, column))],
    parse_number: (value: Value, line: number, column: number) => callBuiltin('numero', [value], at(line, column)),
    list_new: () => [],
    list_push: (list: Value[], value: Value) => {
      list.push(value);
    },
    list_get: (list: Value[], index: number, line: number, column: number) => list[checkIndex(index, list.length, at(line, column))],
    list_set: (list: Value[], index: number, value: Value, line: number, column: number) => {
      list[checkIndex(index, list.length, at(line, column))] = value;
    },
    list_pop: (list: Value[], line: number, column: number) => callBuiltin('quitar', [list], at(line, column)),
    list_concat: (left: Value[], right: Value[]) => [...left, ...right],
    box_number: (value: number) => value,
    unbox_number: (value: number) => value,
    box_bool: (value: number) => value !== 0,
    unbox_bool: (value: boolean) => toFlag(value),
    random_int: (min: number, max: number, line: number, column: number) => callBuiltin('aleatorio', [min, max], at(line, column)),
    square_root: (value: number, line: number, column: number) => callBuiltin('raiz', [value], at(line, column)),
    fail_division_by_zero: (line: number, column: number) => {
      throw new RuntimeError(divisionByZeroMessage, at(line, column));
    },
    fail_zero_step: (line: number, column: number) => {
      throw new RuntimeError(zeroStepMessage, at(line, column));
    },
    fail_too_many_steps: (line: number, column: number) => {
      throw new RuntimeError(tooManyStepsMessage(options.maxSteps), at(line, column));
    },
    fail_too_deep: (name: string, line: number, column: number) => {
      throw new RuntimeError(tooDeepMessage(name), at(line, column));
    },
  };
};
