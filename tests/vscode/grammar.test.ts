import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {beforeAll, describe, expect, test} from 'vitest';
import oniguruma from 'vscode-oniguruma';
import textmate from 'vscode-textmate';
import {QUECHUA_WORDS} from '../../src/index.js';
import {keywords} from '../../src/lexer/token.js';

const require = createRequire(import.meta.url);
let grammar: textmate.IGrammar;

// Clase de color de cada palabra de una línea, según la gramática de la extensión
const scopesOf = (line: string): Map<string, string> => {
  const {tokens} = grammar.tokenizeLine(line, textmate.INITIAL);
  const scopes = new Map<string, string>();
  for (const token of tokens) {
    const text = line.slice(token.startIndex, token.endIndex);
    if (text.trim() !== '') {
      scopes.set(text, token.scopes.at(-1)!);
    }
  }
  return scopes;
};

beforeAll(async () => {
  const wasm = readFileSync(require.resolve('vscode-oniguruma/release/onig.wasm'));
  await oniguruma.loadWASM(wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength));
  const registry = new textmate.Registry({
    onigLib: Promise.resolve({
      createOnigScanner: (patterns) => new oniguruma.OnigScanner(patterns),
      createOnigString: (text) => new oniguruma.OnigString(text),
    }),
    loadGrammar: async () => textmate.parseRawGrammar(readFileSync('vscode/syntaxes/kuntur.tmLanguage.json', 'utf8'), 'kuntur.tmLanguage.json'),
  });
  grammar = (await registry.loadGrammar('source.kuntur'))!;
});

describe('gramática de colores', () => {
  // Cada palabra clave del lenguaje, en español y en quechua, tiene color de palabra del lenguaje
  test('colorea todas las palabras clave', () => {
    const words = [...keywords.keys(), ...[...QUECHUA_WORDS.keys()].filter((word) => !['rikuchiy', 'tapuy'].includes(word))];
    for (const word of words) {
      const scope = scopesOf(word).get(word);
      expect(scope, word).toMatch(/^(keyword|storage|constant\.language)/);
    }
  });

  // Distingue nombres, funciones propias, tipos, textos, números y comentarios
  test('distingue cada clase de token', () => {
    const scopes = scopesOf('funcion area(base: decimal): lista de entero { mostrar("si", 2.5) } // fin');
    expect(scopes.get('funcion')).toBe('storage.type.function.kuntur');
    expect(scopes.get('area')).toBe('entity.name.function.kuntur');
    expect(scopes.get('decimal')).toBe('support.type.kuntur');
    expect(scopes.get('mostrar')).toBe('support.function.builtin.kuntur');
    expect(scopes.get('si')).toBe('string.quoted.double.kuntur');
    expect(scopes.get('2.5')).toBe('constant.numeric.kuntur');
    expect(scopes.get('// fin')).toBe('comment.line.double-slash.kuntur');
  });

  // `cada` y `en` solo son palabras del lenguaje dentro de `para cada`
  test('reconoce para cada y registro', () => {
    const scopes = scopesOf('para cada nota en notas {');
    expect(scopes.get('cada')).toBe('keyword.control.kuntur');
    expect(scopes.get('en')).toBe('keyword.control.kuntur');
    expect(scopesOf('var en = cada').get('en')).not.toBe('keyword.control.kuntur');
    expect(scopesOf('registro Alumno {').get('Alumno')).toBe('entity.name.type.kuntur');
  });

  // Las palabras con apóstrofo se colorean completas
  test('colorea palabras con apóstrofo', () => {
    expect(scopesOf("sichus x { p'akiy }").get("p'akiy")).toBe('keyword.control.kuntur');
    expect(scopesOf('rikuchiy(1)').get('rikuchiy')).toBe('support.function.builtin.kuntur');
  });
});
