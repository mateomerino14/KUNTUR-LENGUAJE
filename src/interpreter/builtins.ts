import type {Position} from '../errors/diagnostic.js';
import {RuntimeError} from './runtimeError.js';
import {describeType, stringify, stringifyLiteral, typeName, type NativeFunction, type Value} from './values.js';

export interface BuiltinOptions {
  write: (line: string) => void;
  random: () => number;
}

const numberPattern = /^-?\d+(\.\d+)?$/;

// Exige que el argumento sea una lista
const expectList = (functionName: string, value: Value, position: Position): Value[] => {
  if (!Array.isArray(value)) {
    throw new RuntimeError(`\`${functionName}\` necesita una lista, pero recibió ${describeType(value)}.`, position);
  }
  return value;
};

// Exige que el argumento sea un número
const expectNumber = (functionName: string, value: Value, position: Position): number => {
  if (typeof value !== 'number') {
    throw new RuntimeError(`\`${functionName}\` necesita un número, pero recibió ${describeType(value)}.`, position);
  }
  return value;
};

// Exige que el argumento sea un número entero
const expectInteger = (functionName: string, value: Value, position: Position): number => {
  const number = expectNumber(functionName, value, position);
  if (!Number.isInteger(number)) {
    throw new RuntimeError(`\`${functionName}\` necesita un número entero, pero recibió ${number}.`, position);
  }
  return number;
};

// Muestra los valores en una línea, separados por un espacio
const createShow = (write: (line: string) => void): NativeFunction => ({
  kind: 'native',
  name: 'mostrar',
  arity: null,
  call: (args) => {
    write(args.map(stringify).join(' '));
    return null;
  },
});

const lengthFunction: NativeFunction = {
  kind: 'native',
  name: 'longitud',
  arity: 1,
  call: ([value], position) => {
    if (Array.isArray(value) || typeof value === 'string') {
      return value.length;
    }
    throw new RuntimeError(`\`longitud\` necesita una lista o un texto, pero recibió ${describeType(value)}.`, position);
  },
};

const appendFunction: NativeFunction = {
  kind: 'native',
  name: 'agregar',
  arity: 2,
  call: ([list, value], position) => {
    expectList('agregar', list, position).push(value);
    return null;
  },
};

const removeLastFunction: NativeFunction = {
  kind: 'native',
  name: 'quitar',
  arity: 1,
  call: ([list], position) => {
    const items = expectList('quitar', list, position);
    if (items.length === 0) {
      throw new RuntimeError('No se puede quitar un elemento de una lista vacía.', position);
    }
    return items.pop()!;
  },
};

const toTextFunction: NativeFunction = {
  kind: 'native',
  name: 'texto',
  arity: 1,
  call: ([value]) => stringify(value),
};

const toNumberFunction: NativeFunction = {
  kind: 'native',
  name: 'numero',
  arity: 1,
  call: ([value], position) => {
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'string' && numberPattern.test(value.trim())) {
      return Number(value.trim());
    }
    throw new RuntimeError(`No se puede convertir ${stringifyLiteral(value)} en número.`, position);
  },
};

const typeFunction: NativeFunction = {
  kind: 'native',
  name: 'tipo',
  arity: 1,
  call: ([value]) => typeName(value),
};

const roundFunction: NativeFunction = {
  kind: 'native',
  name: 'redondear',
  arity: 1,
  call: ([value], position) => Math.round(expectNumber('redondear', value, position)),
};

const squareRootFunction: NativeFunction = {
  kind: 'native',
  name: 'raiz',
  arity: 1,
  call: ([value], position) => {
    const number = expectNumber('raiz', value, position);
    if (number < 0) {
      throw new RuntimeError(`No existe la raíz cuadrada de un número negativo (${number}).`, position);
    }
    return Math.sqrt(number);
  },
};

// Devuelve un entero al azar entre los dos límites, ambos incluidos
const createRandom = (random: () => number): NativeFunction => ({
  kind: 'native',
  name: 'aleatorio',
  arity: 2,
  call: ([min, max], position) => {
    const low = expectInteger('aleatorio', min, position);
    const high = expectInteger('aleatorio', max, position);
    if (low > high) {
      throw new RuntimeError(`\`aleatorio\` necesita el menor primero: \`aleatorio(${high}, ${low})\`.`, position);
    }
    return low + Math.floor(random() * (high - low + 1));
  },
});

// Crea las funciones propias del lenguaje, conectadas a la salida indicada
export const createBuiltins = (options: BuiltinOptions): NativeFunction[] => [
  createShow(options.write),
  lengthFunction,
  appendFunction,
  removeLastFunction,
  toTextFunction,
  toNumberFunction,
  typeFunction,
  roundFunction,
  squareRootFunction,
  createRandom(options.random),
];
