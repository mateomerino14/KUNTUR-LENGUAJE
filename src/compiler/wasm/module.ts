import {encodeName, encodeSection, encodeSigned, encodeUnsigned, encodeVector} from './encoding.js';
import {encodeInstruction, valueTypeCodes, type Instruction, type ValueType} from './instructions.js';

export interface FunctionSignature {
  params: ValueType[];
  results: ValueType[];
}

export interface NamedValue {
  name: string;
  type: ValueType;
}

export interface ImportedFunction {
  module: string;
  field: string;
  name: string;
  signature: FunctionSignature;
}

export interface DefinedFunction {
  name: string;
  signature: FunctionSignature;
  paramNames: string[];
  locals: NamedValue[];
  body: Instruction[];
}

export interface Global {
  name: string;
  type: ValueType;
  init: Instruction;
}

export interface Memory {
  name: string;
  pages: number;
}

export interface Export {
  name: string;
  kind: 'function' | 'memory';
  index: number;
}

export interface DataSegment {
  offset: number;
  bytes: number[];
}

export interface WasmModule {
  imports: ImportedFunction[];
  functions: DefinedFunction[];
  globals: Global[];
  memory: Memory | null;
  exports: Export[];
  data: DataSegment[];
}

const magic = [0x00, 0x61, 0x73, 0x6d];
const version = [0x01, 0x00, 0x00, 0x00];
const functionTypeCode = 0x60;
const mutableGlobal = 0x01;
const exportKindCodes = {function: 0x00, memory: 0x02} as const;
const importFunctionKind = 0x00;
const memoryLimitsWithoutMax = 0x00;
const activeDataSegment = 0x00;
const i32ConstOpcode = 0x41;
const endOpcode = 0x0b;

const sectionIds = {
  type: 1,
  import: 2,
  function: 3,
  memory: 5,
  global: 6,
  export: 7,
  code: 10,
  data: 11,
} as const;

// Clave única de una firma, para no repetir tipos de función en el módulo
const signatureKey = (signature: FunctionSignature): string => {
  return `${signature.params.join(',')}->${signature.results.join(',')}`;
};

// Codifica una firma de función
const encodeSignature = (signature: FunctionSignature): number[] => {
  return [
    functionTypeCode,
    ...encodeVector(signature.params.map((type) => [valueTypeCodes[type]])),
    ...encodeVector(signature.results.map((type) => [valueTypeCodes[type]])),
  ];
};

// Agrupa las variables locales seguidas del mismo tipo, como pide el formato binario
const encodeLocals = (locals: NamedValue[]): number[] => {
  const groups: number[][] = [];
  let index = 0;
  while (index < locals.length) {
    const type = locals[index].type;
    let count = 0;
    while (index < locals.length && locals[index].type === type) {
      count++;
      index++;
    }
    groups.push([...encodeUnsigned(count), valueTypeCodes[type]]);
  }
  return encodeVector(groups);
};

// Codifica el cuerpo de una función con su tamaño
const encodeBody = (fn: DefinedFunction): number[] => {
  const content = [...encodeLocals(fn.locals), ...fn.body.flatMap(encodeInstruction), endOpcode];
  return [...encodeUnsigned(content.length), ...content];
};

// Convierte el módulo en los bytes de un archivo .wasm
export const encodeModule = (module: WasmModule): Uint8Array<ArrayBuffer> => {
  const signatures: FunctionSignature[] = [];
  const signatureIndexes = new Map<string, number>();
  const signatureIndex = (signature: FunctionSignature): number => {
    const key = signatureKey(signature);
    const existing = signatureIndexes.get(key);
    if (existing !== undefined) {
      return existing;
    }
    signatures.push(signature);
    signatureIndexes.set(key, signatures.length - 1);
    return signatures.length - 1;
  };
  const importEntries = module.imports.map((imported) => [
    ...encodeName(imported.module),
    ...encodeName(imported.field),
    importFunctionKind,
    ...encodeUnsigned(signatureIndex(imported.signature)),
  ]);
  const functionEntries = module.functions.map((fn) => encodeUnsigned(signatureIndex(fn.signature)));
  const sections: number[][] = [
    encodeSection(sectionIds.type, encodeVector(signatures.map(encodeSignature))),
    encodeSection(sectionIds.import, encodeVector(importEntries)),
    encodeSection(sectionIds.function, encodeVector(functionEntries)),
  ];
  if (module.memory !== null) {
    sections.push(encodeSection(sectionIds.memory, encodeVector([[memoryLimitsWithoutMax, ...encodeUnsigned(module.memory.pages)]])));
  }
  const globalEntries = module.globals.map((global) => [
    valueTypeCodes[global.type],
    mutableGlobal,
    ...encodeInstruction(global.init),
    endOpcode,
  ]);
  sections.push(encodeSection(sectionIds.global, encodeVector(globalEntries)));
  const exportEntries = module.exports.map((entry) => [
    ...encodeName(entry.name),
    exportKindCodes[entry.kind],
    ...encodeUnsigned(entry.index),
  ]);
  sections.push(encodeSection(sectionIds.export, encodeVector(exportEntries)));
  sections.push(encodeSection(sectionIds.code, encodeVector(module.functions.map(encodeBody))));
  if (module.data.length > 0) {
    const dataEntries = module.data.map((segment) => [
      activeDataSegment,
      i32ConstOpcode,
      ...encodeSigned(segment.offset),
      endOpcode,
      ...encodeVector(segment.bytes.map((byte) => [byte])),
    ]);
    sections.push(encodeSection(sectionIds.data, encodeVector(dataEntries)));
  }
  return new Uint8Array([...magic, ...version, ...sections.flat()]);
};
