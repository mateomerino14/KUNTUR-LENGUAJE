import {dictKeyMessage} from '../errors/messages.js';
import {
  booleanType,
  decimalType,
  describeType,
  integerType,
  isAssignable,
  isNumeric,
  isTextLike,
  listOf,
  isUnknown,
  nullType,
  textType,
  typeToString,
  unknownType,
  type Type,
} from './types.js';

export type ArgumentReporter = (index: number, message: string) => void;

export interface BuiltinSignature {
  name: string;
  arity: number | null;
  check: (args: Type[], report: ArgumentReporter) => Type;
}

// Indica si el tipo puede ser una lista
const isListLike = (type: Type): boolean => type.kind === 'list' || isUnknown(type);

// Exige que el argumento pueda ser un número
const requireNumber = (name: string, type: Type, index: number, report: ArgumentReporter): void => {
  if (!isNumeric(type)) {
    report(index, `\`${name}\` necesita un número, pero recibió ${describeType(type)}.`);
  }
};

// Exige que el argumento pueda ser una lista
const requireList = (name: string, type: Type, index: number, report: ArgumentReporter): void => {
  if (!isListLike(type)) {
    report(index, `\`${name}\` necesita una lista, pero recibió ${describeType(type)}.`);
  }
};

// Exige que el argumento pueda ser un diccionario
const requireDict = (name: string, type: Type, index: number, report: ArgumentReporter): void => {
  if (type.kind !== 'dict' && !isUnknown(type)) {
    report(index, `\`${name}\` necesita un diccionario, pero recibió ${describeType(type)}.`);
  }
};

// Exige que la clave pueda ser un texto
const requireKey = (type: Type, index: number, report: ArgumentReporter): void => {
  if (!isTextLike(type)) {
    report(index, dictKeyMessage(describeType(type)));
  }
};

// Exige que el argumento pueda ser un entero
const requireInteger = (name: string, type: Type, index: number, report: ArgumentReporter): void => {
  if (type.kind !== 'integer' && !isUnknown(type)) {
    report(index, `\`${name}\` necesita un entero, pero recibió ${describeType(type)}.`);
  }
};

// Tipo de los elementos de una lista, o desconocido si no se sabe
const elementOf = (type: Type): Type => {
  if (type.kind === 'list') {
    return type.element;
  }
  return unknownType;
};

const signatures: BuiltinSignature[] = [
  {
    name: 'mostrar',
    arity: null,
    check: () => nullType,
  },
  {
    name: 'longitud',
    arity: 1,
    check: ([value], report) => {
      if (!isListLike(value) && value.kind !== 'text' && value.kind !== 'dict') {
        report(0, `\`longitud\` necesita una lista, un texto o un diccionario, pero recibió ${describeType(value)}.`);
      }
      return integerType;
    },
  },
  {
    name: 'agregar',
    arity: 2,
    check: ([list, value], report) => {
      requireList('agregar', list, 0, report);
      const element = elementOf(list);
      if (!isAssignable(element, value)) {
        report(1, `Esta lista es de ${typeToString(element)}; no se le puede agregar ${describeType(value)}.`);
      }
      return nullType;
    },
  },
  {
    name: 'quitar',
    arity: 1,
    check: ([list], report) => {
      requireList('quitar', list, 0, report);
      return elementOf(list);
    },
  },
  {
    name: 'tiene',
    arity: 2,
    check: ([dict, key], report) => {
      requireDict('tiene', dict, 0, report);
      requireKey(key, 1, report);
      return booleanType;
    },
  },
  {
    name: 'claves',
    arity: 1,
    check: ([dict], report) => {
      requireDict('claves', dict, 0, report);
      return listOf(textType);
    },
  },
  {
    name: 'texto',
    arity: 1,
    check: () => textType,
  },
  {
    name: 'numero',
    arity: 1,
    check: ([value], report) => {
      if (!isNumeric(value) && value.kind !== 'text') {
        report(0, `\`numero\` necesita un texto, pero recibió ${describeType(value)}.`);
      }
      return decimalType;
    },
  },
  {
    name: 'tipo',
    arity: 1,
    check: () => textType,
  },
  {
    name: 'redondear',
    arity: 1,
    check: ([value], report) => {
      requireNumber('redondear', value, 0, report);
      return integerType;
    },
  },
  {
    name: 'raiz',
    arity: 1,
    check: ([value], report) => {
      requireNumber('raiz', value, 0, report);
      return decimalType;
    },
  },
  {
    name: 'leer',
    arity: 1,
    check: ([prompt], report) => {
      if (prompt.kind !== 'text' && !isUnknown(prompt)) {
        report(0, `\`leer\` necesita un texto para preguntar, pero recibió ${describeType(prompt)}.`);
      }
      return textType;
    },
  },
  {
    name: 'aleatorio',
    arity: 2,
    check: ([min, max], report) => {
      requireInteger('aleatorio', min, 0, report);
      requireInteger('aleatorio', max, 1, report);
      return integerType;
    },
  },
];

export const builtinSignatures: ReadonlyMap<string, BuiltinSignature> = new Map(
  signatures.map((signature) => [signature.name, signature]),
);
