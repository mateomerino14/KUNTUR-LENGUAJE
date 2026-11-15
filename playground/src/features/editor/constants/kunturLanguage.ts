import {StreamLanguage, type StringStream} from '@codemirror/language';

const keywords = new Set([
  'var', 'constante', 'funcion', 'función', 'retornar', 'si', 'sino', 'mientras', 'para',
  'desde', 'hasta', 'paso', 'romper', 'continuar', 'y', 'o', 'no',
]);
const atoms = new Set(['verdadero', 'falso', 'nulo']);
const typeNames = new Set(['entero', 'decimal', 'texto', 'logico', 'lógico', 'lista', 'de']);
const builtins = new Set(['mostrar', 'longitud', 'agregar', 'quitar', 'texto', 'numero', 'tipo', 'redondear', 'raiz', 'aleatorio', 'leer']);

interface KunturState {
  afterColon: boolean;
}

// Indica qué estilo le corresponde a una palabra según su lugar en el código
const wordStyle = (word: string, stream: StringStream, state: KunturState): string => {
  if (keywords.has(word)) {
    state.afterColon = false;
    return 'keyword';
  }
  if (atoms.has(word)) {
    return 'atom';
  }
  if (state.afterColon && typeNames.has(word)) {
    return 'typeName';
  }
  if (builtins.has(word) && stream.peek() === '(') {
    return 'builtin';
  }
  return 'variableName';
};

export const kunturLanguage = StreamLanguage.define<KunturState>({
  name: 'kuntur',
  startState: () => ({afterColon: false}),
  token: (stream, state) => {
    if (stream.sol()) {
      state.afterColon = false;
    }
    if (stream.eatSpace()) {
      return null;
    }
    if (stream.match('//')) {
      stream.skipToEnd();
      return 'comment';
    }
    if (stream.match(/^"([^"\\]|\\.)*"?/)) {
      return 'string';
    }
    if (stream.match(/^\d+(\.\d+)?/)) {
      return 'number';
    }
    if (stream.match(/^[\p{L}_][\p{L}\p{N}_]*/u)) {
      return wordStyle(stream.current(), stream, state);
    }
    const char = stream.next();
    if (char === ':') {
      state.afterColon = true;
      return 'punctuation';
    }
    if (char === '=' || char === ')' || char === ',' || char === '{') {
      state.afterColon = false;
    }
    if (char !== undefined && '+-*/%=<>!'.includes(char)) {
      stream.eat('=');
      return 'operator';
    }
    return 'punctuation';
  },
  languageData: {
    commentTokens: {line: '//'},
  },
});
