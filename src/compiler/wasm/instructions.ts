import {encodeF64, encodeSigned, encodeUnsigned} from './encoding.js';

export type ValueType = 'i32' | 'f64' | 'externref';

export const valueTypeCodes: Readonly<Record<ValueType, number>> = {
  i32: 0x7f,
  f64: 0x7c,
  externref: 0x6f,
};

const emptyBlockType = 0x40;

const simpleOpcodes = {
  'unreachable': 0x00,
  'else': 0x05,
  'end': 0x0b,
  'return': 0x0f,
  'drop': 0x1a,
  'i32.eqz': 0x45,
  'i32.eq': 0x46,
  'i32.ne': 0x47,
  'i32.lt_s': 0x48,
  'i32.gt_s': 0x4a,
  'i32.le_s': 0x4c,
  'i32.ge_s': 0x4e,
  'f64.eq': 0x61,
  'f64.ne': 0x62,
  'f64.lt': 0x63,
  'f64.gt': 0x64,
  'f64.le': 0x65,
  'f64.ge': 0x66,
  'i32.add': 0x6a,
  'i32.sub': 0x6b,
  'i32.and': 0x71,
  'i32.or': 0x72,
  'f64.neg': 0x9a,
  'f64.floor': 0x9c,
  'f64.trunc': 0x9d,
  'f64.sqrt': 0x9f,
  'f64.add': 0xa0,
  'f64.sub': 0xa1,
  'f64.mul': 0xa2,
  'f64.div': 0xa3,
} as const;

export type SimpleOp = keyof typeof simpleOpcodes;

export type Instruction =
  | {op: SimpleOp}
  | {op: 'i32.const'; value: number}
  | {op: 'f64.const'; value: number}
  | {op: 'local.get' | 'local.set' | 'local.tee'; index: number}
  | {op: 'global.get' | 'global.set'; index: number}
  | {op: 'call'; index: number}
  | {op: 'br' | 'br_if'; depth: number}
  | {op: 'block' | 'loop' | 'if'; result: ValueType | null}
  | {op: 'ref.null'};

const indexedOpcodes = {
  'local.get': 0x20,
  'local.set': 0x21,
  'local.tee': 0x22,
  'global.get': 0x23,
  'global.set': 0x24,
  'call': 0x10,
} as const;

const blockOpcodes = {
  block: 0x02,
  loop: 0x03,
  if: 0x04,
} as const;

const branchOpcodes = {
  'br': 0x0c,
  'br_if': 0x0d,
} as const;

const i32ConstOpcode = 0x41;
const f64ConstOpcode = 0x44;
const refNullOpcode = 0xd0;

// Codifica el tipo de resultado de un bloque: vacío o un tipo de valor
const encodeBlockType = (result: ValueType | null): number => {
  if (result === null) {
    return emptyBlockType;
  }
  return valueTypeCodes[result];
};

// Codifica una instrucción con sus operandos inmediatos
export const encodeInstruction = (instruction: Instruction): number[] => {
  switch (instruction.op) {
    case 'i32.const':
      return [i32ConstOpcode, ...encodeSigned(instruction.value)];
    case 'f64.const':
      return [f64ConstOpcode, ...encodeF64(instruction.value)];
    case 'local.get':
    case 'local.set':
    case 'local.tee':
    case 'global.get':
    case 'global.set':
    case 'call':
      return [indexedOpcodes[instruction.op], ...encodeUnsigned(instruction.index)];
    case 'br':
    case 'br_if':
      return [branchOpcodes[instruction.op], ...encodeUnsigned(instruction.depth)];
    case 'block':
    case 'loop':
    case 'if':
      return [blockOpcodes[instruction.op], encodeBlockType(instruction.result)];
    case 'ref.null':
      return [refNullOpcode, valueTypeCodes.externref];
    default:
      return [simpleOpcodes[instruction.op]];
  }
};

// Crea una instrucción sin operandos
export const op = (name: SimpleOp): Instruction => ({op: name});
