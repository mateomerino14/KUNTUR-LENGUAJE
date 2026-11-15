export type PrimitiveKind = 'integer' | 'decimal' | 'text' | 'boolean' | 'null' | 'unknown';

export interface PrimitiveType {
  kind: PrimitiveKind;
}

export interface ListType {
  kind: 'list';
  element: Type;
}

export interface FunctionType {
  kind: 'function';
  name: string;
  params: Type[];
  paramNames: string[];
  returns: Type;
}

export type Type = PrimitiveType | ListType | FunctionType;

export const integerType: PrimitiveType = {kind: 'integer'};
export const decimalType: PrimitiveType = {kind: 'decimal'};
export const textType: PrimitiveType = {kind: 'text'};
export const booleanType: PrimitiveType = {kind: 'boolean'};
export const nullType: PrimitiveType = {kind: 'null'};
export const unknownType: PrimitiveType = {kind: 'unknown'};

export const typeNames: ReadonlyMap<string, Type> = new Map([
  ['entero', integerType],
  ['decimal', decimalType],
  ['texto', textType],
  ['logico', booleanType],
  ['lógico', booleanType],
]);

export const listTypeName = 'lista';

const primitiveNames: Readonly<Record<PrimitiveKind, string>> = {
  integer: 'entero',
  decimal: 'decimal',
  text: 'texto',
  boolean: 'lógico',
  null: 'nulo',
  unknown: 'desconocido',
};

const primitiveDescriptions: Readonly<Record<PrimitiveKind, string>> = {
  integer: 'un entero',
  decimal: 'un decimal',
  text: 'un texto',
  boolean: 'un valor lógico',
  null: 'nulo',
  unknown: 'un valor desconocido',
};

// Crea el tipo de una lista con el tipo de sus elementos
export const listOf = (element: Type): ListType => ({kind: 'list', element});

// Escribe el tipo como se anota en Kuntur
export const typeToString = (type: Type): string => {
  if (type.kind === 'list') {
    if (type.element.kind === 'unknown') {
      return 'lista';
    }
    return `lista de ${typeToString(type.element)}`;
  }
  if (type.kind === 'function') {
    return 'función';
  }
  return primitiveNames[type.kind];
};

// Describe el tipo con su artículo, para usarlo dentro de una oración
export const describeType = (type: Type): string => {
  if (type.kind === 'list') {
    return `una ${typeToString(type)}`;
  }
  if (type.kind === 'function') {
    return 'una función';
  }
  return primitiveDescriptions[type.kind];
};

// Indica si el tipo no se conoce hasta ejecutar
export const isUnknown = (type: Type): boolean => type.kind === 'unknown';

// Indica si el tipo puede ser un número
export const isNumeric = (type: Type): boolean => {
  return type.kind === 'integer' || type.kind === 'decimal' || type.kind === 'unknown';
};

// Indica si el tipo puede ser un texto
export const isTextLike = (type: Type): boolean => type.kind === 'text' || type.kind === 'unknown';

// Indica si el tipo puede ser verdadero o falso
export const isBooleanLike = (type: Type): boolean => type.kind === 'boolean' || type.kind === 'unknown';

// Indica si un valor del tipo de origen se puede guardar donde se espera el tipo de destino
export const isAssignable = (target: Type, source: Type): boolean => {
  if (isUnknown(target) || isUnknown(source)) {
    return true;
  }
  if (target.kind === 'decimal' && source.kind === 'integer') {
    return true;
  }
  if (target.kind === 'list' && source.kind === 'list') {
    // Las listas deben coincidir en sus elementos: una lista de entero no es una lista de decimal
    if (isUnknown(target.element) || isUnknown(source.element)) {
      return true;
    }
    return isAssignable(target.element, source.element) && isAssignable(source.element, target.element);
  }
  return target.kind === source.kind;
};

// Tipo común de dos tipos, para listas con elementos variados; desconocido si no hay uno
export const commonType = (first: Type, second: Type): Type => {
  if (isUnknown(first) || isUnknown(second)) {
    return unknownType;
  }
  if (isAssignable(first, second)) {
    return first;
  }
  if (isAssignable(second, first)) {
    return second;
  }
  return unknownType;
};

// Tipo del resultado de una operación entre dos números
export const numericResult = (left: Type, right: Type): Type => {
  if (isUnknown(left) || isUnknown(right)) {
    return unknownType;
  }
  if (left.kind === 'integer' && right.kind === 'integer') {
    return integerType;
  }
  return decimalType;
};
