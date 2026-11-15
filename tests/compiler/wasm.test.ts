import {describe, expect, test} from 'vitest';
import {encodeF64, encodeSigned, encodeUnsigned} from '../../src/compiler/wasm/encoding.js';
import {encodeModule, type WasmModule} from '../../src/compiler/wasm/module.js';
import {moduleToText, watIdentifier} from '../../src/compiler/wasm/text.js';

describe('codificación', () => {
  // Los enteros sin signo usan 7 bits por byte
  test('codifica enteros sin signo en LEB128', () => {
    expect(encodeUnsigned(0)).toEqual([0x00]);
    expect(encodeUnsigned(127)).toEqual([0x7f]);
    expect(encodeUnsigned(128)).toEqual([0x80, 0x01]);
    expect(encodeUnsigned(624485)).toEqual([0xe5, 0x8e, 0x26]);
  });

  // Los enteros con signo extienden el bit de signo
  test('codifica enteros con signo en LEB128', () => {
    expect(encodeSigned(0)).toEqual([0x00]);
    expect(encodeSigned(-1)).toEqual([0x7f]);
    expect(encodeSigned(63)).toEqual([0x3f]);
    expect(encodeSigned(64)).toEqual([0xc0, 0x00]);
    expect(encodeSigned(-123456)).toEqual([0xc0, 0xbb, 0x78]);
  });

  // Los decimales ocupan 8 bytes en orden little-endian
  test('codifica números de 64 bits', () => {
    expect(encodeF64(1)).toEqual([0, 0, 0, 0, 0, 0, 0xf0, 0x3f]);
  });

  // Los nombres con tildes se escriben con su código en WAT
  test('convierte nombres con tildes en identificadores de WAT', () => {
    expect(watIdentifier('edad')).toBe('$edad');
    expect(watIdentifier('año')).toBe('$a_uf1_o');
  });
});

describe('módulos', () => {
  const doubleModule: WasmModule = {
    imports: [{module: 'kuntur', field: 'show', name: 'mostrar', signature: {params: ['f64'], results: []}}],
    functions: [
      {
        name: 'doble',
        signature: {params: ['f64'], results: ['f64']},
        paramNames: ['n'],
        locals: [],
        body: [{op: 'local.get', index: 0}, {op: 'f64.const', value: 2}, {op: 'f64.mul'}],
      },
      {
        name: 'principal',
        signature: {params: [], results: []},
        paramNames: [],
        locals: [],
        body: [{op: 'f64.const', value: 21}, {op: 'call', index: 1}, {op: 'call', index: 0}],
      },
    ],
    globals: [],
    memory: null,
    exports: [{name: 'principal', kind: 'function', index: 2}],
    data: [],
  };

  // El módulo binario es válido y se puede ejecutar
  test('arma un módulo binario que se ejecuta', async () => {
    const binary = encodeModule(doubleModule);
    expect(WebAssembly.validate(binary)).toBe(true);
    const shown: number[] = [];
    const {instance} = await WebAssembly.instantiate(binary, {kuntur: {show: (value: number) => shown.push(value)}});
    (instance.exports.principal as () => void)();
    expect(shown).toEqual([42]);
  });

  // El texto usa los nombres de las funciones y de los parámetros
  test('escribe el módulo en formato de texto', () => {
    const text = moduleToText(doubleModule);
    expect(text).toContain('(import "kuntur" "show" (func $mostrar (param f64)))');
    expect(text).toContain('(func $doble (param $n f64) (result f64)');
    expect(text).toContain('call $doble');
  });
});
