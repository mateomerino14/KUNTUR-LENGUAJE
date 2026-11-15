import type {Instruction, ValueType} from './instructions.js';
import type {DefinedFunction, FunctionSignature, WasmModule} from './module.js';

const indentUnit = '  ';
const firstPrintableByte = 0x20;
const lastPrintableByte = 0x7e;
const hexRadix = 16;
const quoteByte = 0x22;
const backslashByte = 0x5c;
const allowedIdentifier = /^[0-9A-Za-z!#$%&'*+\-./:<=>?@\\^_`|~]+$/;

// Convierte un nombre de Kuntur en un identificador válido de WAT; las letras con tilde se escriben con su código
export const watIdentifier = (name: string): string => {
  if (allowedIdentifier.test(name)) {
    return `$${name}`;
  }
  const escaped = Array.from(name).map((char) => {
    if (allowedIdentifier.test(char)) {
      return char;
    }
    return `_u${char.codePointAt(0)!.toString(hexRadix)}_`;
  });
  return `$${escaped.join('')}`;
};

// Escribe un texto de WAT con los bytes no imprimibles en hexadecimal
const watString = (bytes: number[]): string => {
  const parts = bytes.map((byte) => {
    if (byte >= firstPrintableByte && byte <= lastPrintableByte && byte !== quoteByte && byte !== backslashByte) {
      return String.fromCharCode(byte);
    }
    return `\\${byte.toString(hexRadix).padStart(2, '0')}`;
  });
  return `"${parts.join('')}"`;
};

// Escribe los parámetros y resultados de una firma
const signatureText = (signature: FunctionSignature, paramNames: string[] | null): string => {
  const parts: string[] = [];
  signature.params.forEach((type, index) => {
    if (paramNames === null) {
      parts.push(`(param ${type})`);
    }
    else {
      parts.push(`(param ${watIdentifier(paramNames[index])} ${type})`);
    }
  });
  for (const type of signature.results) {
    parts.push(`(result ${type})`);
  }
  return parts.join(' ');
};

// Une las partes no vacías con un espacio
const joinParts = (parts: string[]): string => parts.filter((part) => part !== '').join(' ');

// Escribe el resultado de un bloque, si tiene
const blockResultText = (result: ValueType | null): string => {
  if (result === null) {
    return '';
  }
  return ` (result ${result})`;
};

interface NameTables {
  functions: string[];
  globals: string[];
  locals: string[];
}

// Escribe una instrucción usando los nombres de funciones, variables globales y locales
const instructionText = (instruction: Instruction, names: NameTables): string => {
  switch (instruction.op) {
    case 'i32.const':
    case 'f64.const':
      return `${instruction.op} ${instruction.value}`;
    case 'local.get':
    case 'local.set':
    case 'local.tee':
      return `${instruction.op} ${watIdentifier(names.locals[instruction.index])}`;
    case 'global.get':
    case 'global.set':
      return `${instruction.op} ${watIdentifier(names.globals[instruction.index])}`;
    case 'call':
      return `call ${watIdentifier(names.functions[instruction.index])}`;
    case 'br':
    case 'br_if':
      return `${instruction.op} ${instruction.depth}`;
    case 'block':
    case 'loop':
    case 'if':
      return `${instruction.op}${blockResultText(instruction.result)}`;
    case 'ref.null':
      return 'ref.null extern';
    default:
      return instruction.op;
  }
};

// Escribe el cuerpo de una función con sangría según los bloques
const bodyText = (body: Instruction[], names: NameTables, baseIndent: string): string[] => {
  const lines: string[] = [];
  let depth = 0;
  for (const instruction of body) {
    if (instruction.op === 'end' || instruction.op === 'else') {
      depth--;
    }
    lines.push(`${baseIndent}${indentUnit.repeat(depth)}${instructionText(instruction, names)}`);
    if (instruction.op === 'block' || instruction.op === 'loop' || instruction.op === 'if' || instruction.op === 'else') {
      depth++;
    }
  }
  return lines;
};

// Escribe una función definida en el módulo
const functionText = (fn: DefinedFunction, functionNames: string[], globalNames: string[]): string[] => {
  const header = `${indentUnit}(${joinParts(['func', watIdentifier(fn.name), signatureText(fn.signature, fn.paramNames)])}`;
  const locals = fn.locals.map((local) => `${indentUnit.repeat(2)}(local ${watIdentifier(local.name)} ${local.type})`);
  const names = {functions: functionNames, globals: globalNames, locals: [...fn.paramNames, ...fn.locals.map((local) => local.name)]};
  return [header, ...locals, ...bodyText(fn.body, names, indentUnit.repeat(2)), `${indentUnit})`];
};

// Escribe el módulo completo en el formato de texto de WebAssembly
export const moduleToText = (module: WasmModule): string => {
  const functionNames = [...module.imports.map((imported) => imported.name), ...module.functions.map((fn) => fn.name)];
  const globalNames = module.globals.map((global) => global.name);
  const lines = ['(module'];
  for (const imported of module.imports) {
    const func = joinParts(['func', watIdentifier(imported.name), signatureText(imported.signature, null)]);
    lines.push(`${indentUnit}(import "${imported.module}" "${imported.field}" (${func}))`);
  }
  if (module.memory !== null) {
    lines.push(`${indentUnit}(memory ${watIdentifier(module.memory.name)} ${module.memory.pages})`);
  }
  for (const global of module.globals) {
    const init = instructionText(global.init, {functions: [], globals: [], locals: []});
    lines.push(`${indentUnit}(global ${watIdentifier(global.name)} (mut ${global.type}) (${init}))`);
  }
  for (const fn of module.functions) {
    lines.push(...functionText(fn, functionNames, globalNames));
  }
  for (const entry of module.exports) {
    if (entry.kind === 'memory') {
      lines.push(`${indentUnit}(export "${entry.name}" (memory ${entry.index}))`);
    }
    else {
      lines.push(`${indentUnit}(export "${entry.name}" (func ${watIdentifier(functionNames[entry.index])}))`);
    }
  }
  for (const segment of module.data) {
    lines.push(`${indentUnit}(data (i32.const ${segment.offset}) ${watString(segment.bytes)})`);
  }
  lines.push(')');
  return lines.join('\n');
};
