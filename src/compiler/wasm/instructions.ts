import {encodeF64, encodeSigned, encodeSigned64, encodeUnsigned} from './encoding.js';

export type ValueType = 'i32' | 'i64' | 'f64' | 'externref';

export const valueTypeCodes: Readonly<Record<ValueType, number>> = {
  i32: 0x7f,
  i64: 0x7e,
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
  'select': 0x1b,
  'i32.eqz': 0x45,
  'i32.eq': 0x46,
  'i32.ne': 0x47,
  'i32.lt_s': 0x48,
  'i32.lt_u': 0x49,
  'i32.gt_s': 0x4a,
  'i32.gt_u': 0x4b,
  'i32.le_s': 0x4c,
  'i32.le_u': 0x4d,
  'i32.ge_s': 0x4e,
  'i32.ge_u': 0x4f,
  'i64.eqz': 0x50,
  'i64.eq': 0x51,
  'i64.ne': 0x52,
  'i64.lt_u': 0x54,
  'i64.gt_u': 0x56,
  'i64.le_u': 0x58,
  'i64.ge_u': 0x5a,
  'f64.eq': 0x61,
  'f64.ne': 0x62,
  'f64.lt': 0x63,
  'f64.gt': 0x64,
  'f64.le': 0x65,
  'f64.ge': 0x66,
  'i32.add': 0x6a,
  'i32.sub': 0x6b,
  'i32.mul': 0x6c,
  'i32.div_u': 0x6e,
  'i32.rem_u': 0x70,
  'i32.and': 0x71,
  'i32.or': 0x72,
  'i32.xor': 0x73,
  'i32.shl': 0x74,
  'i32.shr_u': 0x76,
  'i64.and': 0x83,
  'i64.add': 0x7c,
  'i64.sub': 0x7d,
  'i64.mul': 0x7e,
  'i64.div_u': 0x80,
  'i64.rem_u': 0x82,
  'i64.shr_u': 0x88,
  'f64.abs': 0x99,
  'f64.neg': 0x9a,
  'f64.ceil': 0x9b,
  'f64.floor': 0x9c,
  'f64.trunc': 0x9d,
  'f64.nearest': 0x9e,
  'f64.sqrt': 0x9f,
  'f64.add': 0xa0,
  'f64.sub': 0xa1,
  'f64.mul': 0xa2,
  'f64.div': 0xa3,
  'i32.wrap_i64': 0xa7,
  'i32.trunc_f64_s': 0xaa,
  'i32.trunc_f64_u': 0xab,
  'i64.extend_i32_u': 0xad,
  'i64.trunc_f64_s': 0xb0,
  'i64.trunc_f64_u': 0xb1,
  'f64.convert_i32_s': 0xb7,
  'f64.convert_i32_u': 0xb8,
  'f64.convert_i64_s': 0xb9,
  'f64.convert_i64_u': 0xba,
  'i64.reinterpret_f64': 0xbd,
  'f64.reinterpret_i64': 0xbf,
} as const;

export type SimpleOp = keyof typeof simpleOpcodes;

const memoryOpcodes = {
  'i32.load': 0x28,
  'i64.load': 0x29,
  'f64.load': 0x2b,
  'i32.load8_u': 0x2d,
  'i32.store': 0x36,
  'i64.store': 0x37,
  'f64.store': 0x39,
  'i32.store8': 0x3a,
} as const;

export type MemoryOp = keyof typeof memoryOpcodes;

export type Instruction =
  | {op: SimpleOp}
  | {op: MemoryOp; offset: number}
  | {op: 'memory.size' | 'memory.grow' | 'memory.copy'}
  | {op: 'i32.const'; value: number}
  | {op: 'i64.const'; value: bigint}
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
const i64ConstOpcode = 0x42;
const memorySizeOpcode = 0x3f;
const memoryGrowOpcode = 0x40;
const bulkMemoryPrefix = 0xfc;
const memoryCopyCode = 10;
const memoryIndex = 0x00;
// Alineación 0: el código no promete direcciones alineadas, lo que siempre es válido
const unalignedHint = 0;
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
    case 'i64.const':
      return [i64ConstOpcode, ...encodeSigned64(instruction.value)];
    case 'memory.size':
      return [memorySizeOpcode, memoryIndex];
    case 'memory.grow':
      return [memoryGrowOpcode, memoryIndex];
    case 'memory.copy':
      return [bulkMemoryPrefix, ...encodeUnsigned(memoryCopyCode), memoryIndex, memoryIndex];
    case 'i32.load':
    case 'i64.load':
    case 'f64.load':
    case 'i32.load8_u':
    case 'i32.store':
    case 'i64.store':
    case 'f64.store':
    case 'i32.store8':
      return [memoryOpcodes[instruction.op], ...encodeUnsigned(unalignedHint), ...encodeUnsigned(instruction.offset)];
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

// Indica si la instrucción lee o escribe en la memoria con un desplazamiento
export const isMemoryOp = (name: string): name is MemoryOp => name in memoryOpcodes;

// Indica si la instrucción no tiene operandos inmediatos
export const isSimpleOp = (name: string): name is SimpleOp => name in simpleOpcodes;
