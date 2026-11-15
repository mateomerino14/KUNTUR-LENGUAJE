import type {Position} from '../errors/diagnostic.js';
import {
  emptyListPopMessage,
  invalidNumberMessage,
  negativeRootMessage,
  noMoreInputMessage,
  reversedRandomMessage,
} from '../errors/messages.js';
import {RuntimeError} from './runtimeError.js';
import {checkKey} from './indexing.js';
import {describeType, isDict, stringify, stringifyLiteral, typeName, type Dict, type NativeFunction, type Value} from './values.js';

export type ReadLine = (prompt: string) => string | null;

// Fuente de entrada vacía, para cuando el programa no recibe datos
export const noInput: ReadLine = () => null;

export interface BuiltinOptions {
  write: (line: string) => void;
  random: () => number;
  read: ReadLine;
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
    if (isDict(value)) {
      return value.size;
    }
    throw new RuntimeError(`\`longitud\` necesita una lista, un texto o un diccionario, pero recibió ${describeType(value)}.`, position);
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
      throw new RuntimeError(emptyListPopMessage, position);
    }
    return items.pop()!;
  },
};

// Exige que el argumento sea un diccionario
const expectDict = (functionName: string, value: Value, position: Position): Dict => {
  if (!isDict(value)) {
    throw new RuntimeError(`\`${functionName}\` necesita un diccionario, pero recibió ${describeType(value)}.`, position);
  }
  return value;
};

const hasKeyFunction: NativeFunction = {
  kind: 'native',
  name: 'tiene',
  arity: 2,
  call: ([dict, key], position) => expectDict('tiene', dict, position).has(checkKey(key, position)),
};

const keysFunction: NativeFunction = {
  kind: 'native',
  name: 'claves',
  arity: 1,
  call: ([dict], position) => [...expectDict('claves', dict, position).keys()],
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
    throw new RuntimeError(invalidNumberMessage(stringifyLiteral(value)), position);
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
      throw new RuntimeError(negativeRootMessage(String(number)), position);
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
      throw new RuntimeError(reversedRandomMessage(String(high), String(low)), position);
    }
    return low + Math.floor(random() * (high - low + 1));
  },
});

// Pregunta con el mensaje y devuelve la línea que escribió la persona, como texto
const createRead = (read: ReadLine): NativeFunction => ({
  kind: 'native',
  name: 'leer',
  arity: 1,
  call: ([prompt], position) => {
    if (typeof prompt !== 'string') {
      throw new RuntimeError(`\`leer\` necesita un texto para preguntar, pero recibió ${describeType(prompt)}.`, position);
    }
    const answer = read(prompt);
    if (answer === null) {
      throw new RuntimeError(noMoreInputMessage, position);
    }
    return answer;
  },
});

// Crea las funciones propias del lenguaje, conectadas a la salida, la entrada y el azar indicados
export const createBuiltins = (options: BuiltinOptions): NativeFunction[] => [
  createShow(options.write),
  lengthFunction,
  appendFunction,
  removeLastFunction,
  hasKeyFunction,
  keysFunction,
  toTextFunction,
  toNumberFunction,
  typeFunction,
  roundFunction,
  squareRootFunction,
  createRandom(options.random),
  createRead(options.read),
];
