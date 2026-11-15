import {StreamLanguage, type StringStream} from '@codemirror/language';
import {QUECHUA_WORDS, type Language} from '../../../../../src/index.js';

const keywords = new Set([
  'var', 'constante', 'funcion', 'función', 'retornar', 'si', 'sino', 'mientras', 'para',
  'desde', 'hasta', 'paso', 'romper', 'continuar', 'y', 'o', 'no',
]);
const atoms = new Set(['verdadero', 'falso', 'nulo']);
const typeNames = new Set(['entero', 'decimal', 'texto', 'logico', 'lógico', 'lista', 'diccionario', 'de']);
const builtins = new Set(['mostrar', 'longitud', 'agregar', 'quitar', 'tiene', 'claves', 'texto', 'numero', 'tipo', 'redondear', 'raiz', 'aleatorio', 'leer']);

interface Vocabulary {
  keywords: Set<string>;
  atoms: Set<string>;
  builtins: Set<string>;
  forWords: Set<string>;
  word: RegExp;
}

// Agrega a cada grupo las palabras en quechua que equivalen a las suyas
const quechuaVocabulary = (): Vocabulary => {
  const vocabulary: Vocabulary = {
    keywords: new Set(keywords),
    atoms: new Set(atoms),
    builtins: new Set(builtins),
    forWords: new Set(['para', 'sapanka']),
    word: /^[\p{L}_](?:[\p{L}\p{N}_]|['’](?=\p{L}))*/u,
  };
  for (const [quechua, spanish] of QUECHUA_WORDS) {
    const parts = quechua.split(' ');
    for (const group of [vocabulary.keywords, vocabulary.atoms, vocabulary.builtins]) {
      if (group.has(spanish)) {
        parts.forEach((part) => group.add(part));
      }
    }
  }
  return vocabulary;
};

const spanishVocabulary: Vocabulary = {keywords, atoms, builtins, forWords: new Set(['para']), word: /^[\p{L}_][\p{L}\p{N}_]*/u};

interface KunturState {
  afterColon: boolean;
  forEach: 'none' | 'afterFor' | 'afterEach';
}

// Indica qué estilo le corresponde a una palabra según su lugar en el código
const wordStyle = (word: string, stream: StringStream, state: KunturState, vocabulary: Vocabulary): string => {
  const forEach = state.forEach;
  state.forEach = 'none';
  if (forEach === 'afterFor' && word === 'cada') {
    state.forEach = 'afterEach';
    return 'keyword';
  }
  if (forEach === 'afterEach' && word === 'en') {
    return 'keyword';
  }
  if (forEach === 'afterEach') {
    state.forEach = 'afterEach';
  }
  if (vocabulary.forWords.has(word)) {
    state.forEach = 'afterFor';
  }
  if (word === 'registro' && stream.match(/^\s+[\p{L}_]/u, false)) {
    return 'keyword';
  }
  if (vocabulary.keywords.has(word)) {
    state.afterColon = false;
    return 'keyword';
  }
  if (vocabulary.atoms.has(word)) {
    return 'atom';
  }
  if (state.afterColon && typeNames.has(word)) {
    return 'typeName';
  }
  if (vocabulary.builtins.has(word) && stream.peek() === '(') {
    return 'builtin';
  }
  return 'variableName';
};

// Resaltado de Kuntur para el idioma en que están escritas las palabras del programa
export const kunturLanguage = (language: Language) => {
  let vocabulary = spanishVocabulary;
  if (language === 'qu') {
    vocabulary = quechuaVocabulary();
  }
  return StreamLanguage.define<KunturState>({
    name: 'kuntur',
    startState: () => ({afterColon: false, forEach: 'none'}),
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
      if (stream.match(vocabulary.word)) {
        return wordStyle(stream.current(), stream, state, vocabulary);
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
};
