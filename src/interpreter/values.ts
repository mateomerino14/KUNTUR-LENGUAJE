import type {Position} from '../errors/diagnostic.js';
import type {FunctionDeclaration} from '../parser/ast.js';
import type {Environment} from './environment.js';

export interface UserFunction {
  kind: 'function';
  declaration: FunctionDeclaration;
  closure: Environment;
}

export interface NativeFunction {
  kind: 'native';
  name: string;
  arity: number | null;
  call: (args: Value[], position: Position) => Value;
}

export type Callable = UserFunction | NativeFunction;

export type Value = number | string | boolean | null | Value[] | Callable;

// Indica si el valor es una función del usuario o propia del lenguaje
export const isCallable = (value: Value): value is Callable => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

// Nombre del tipo del valor, tal como lo ve quien programa en Kuntur
export const typeName = (value: Value): string => {
  if (value === null) {
    return 'nulo';
  }
  if (typeof value === 'number') {
    return 'número';
  }
  if (typeof value === 'string') {
    return 'texto';
  }
  if (typeof value === 'boolean') {
    return 'lógico';
  }
  if (Array.isArray(value)) {
    return 'lista';
  }
  return 'función';
};

const typeDescriptions: Readonly<Record<string, string>> = {
  'nulo': 'nulo',
  'número': 'un número',
  'texto': 'un texto',
  'lógico': 'un valor lógico',
  'lista': 'una lista',
  'función': 'una función',
};

// Describe el tipo con su artículo, para usarlo dentro de una oración
export const describeType = (value: Value): string => typeDescriptions[typeName(value)];

// Nombre de una función para mostrarla
const callableName = (callable: Callable): string => {
  if (callable.kind === 'native') {
    return callable.name;
  }
  return callable.declaration.name;
};

// Convierte un valor en texto; dentro de listas los textos van entre comillas
const stringifyValue = (value: Value, nested: boolean, seen: Set<Value[]>): string => {
  if (value === null) {
    return 'nulo';
  }
  if (typeof value === 'boolean') {
    if (value) {
      return 'verdadero';
    }
    return 'falso';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'string') {
    if (nested) {
      return JSON.stringify(value);
    }
    return value;
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return '[...]';
    }
    seen.add(value);
    const items = value.map((item) => stringifyValue(item, true, seen));
    seen.delete(value);
    return `[${items.join(', ')}]`;
  }
  return `<función ${callableName(value)}>`;
};

// Convierte un valor en el texto que muestra `mostrar`
export const stringify = (value: Value): string => stringifyValue(value, false, new Set());

// Convierte un valor en texto como se escribiría en el código, con los textos entre comillas
export const stringifyLiteral = (value: Value): string => stringifyValue(value, true, new Set());

// Compara dos valores; las listas se comparan elemento por elemento
export const valuesEqual = (left: Value, right: Value): boolean => {
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) {
      return false;
    }
    return left.every((item, index) => valuesEqual(item, right[index]));
  }
  return left === right;
};
