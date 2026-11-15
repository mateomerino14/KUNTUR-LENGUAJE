import {tokenize} from '../lexer/lexer.js';
import {keywords, TokenType, type Token} from '../lexer/token.js';
import {QUECHUA_WORDS, toQuechua, type Language} from './quechua.js';

interface Replacement {
  start: number;
  length: number;
  text: string;
}

const keywordTypes: ReadonlySet<TokenType> = new Set(keywords.values());
const translatedBuiltins: ReadonlySet<string> = new Set(['mostrar', 'leer']);
const quechuaReserved: ReadonlySet<string> = new Set([...QUECHUA_WORDS.keys()].map((word) => word.split(' ')[0]));

// Posición en el texto donde empieza cada línea
const lineStarts = (source: string): number[] => {
  const starts = [0];
  for (let index = 0; index < source.length; index++) {
    if (source[index] === '\n') {
      starts.push(index + 1);
    }
  }
  return starts;
};

// Texto que debe ocupar el lugar del token en el otro idioma, o null si queda igual
const translatedText = (token: Token, to: Language): string | null => {
  const isWord = keywordTypes.has(token.type) || token.type === TokenType.Identifier;
  if (!isWord) {
    return null;
  }
  if (to === 'es') {
    if (token.original !== undefined) {
      return token.lexeme;
    }
    if (/['’]/.test(token.lexeme)) {
      return token.lexeme.replace(/['’]/g, '_');
    }
    return null;
  }
  if (keywordTypes.has(token.type) || translatedBuiltins.has(token.lexeme)) {
    return toQuechua(token.lexeme);
  }
  if (quechuaReserved.has(token.lexeme)) {
    return `${token.lexeme}_`;
  }
  return null;
};

// Traduce las palabras del lenguaje de un programa al otro idioma; los nombres propios que chocan se renombran con `_`
export const translateSource = (source: string, to: Language): string => {
  let from: Language = 'es';
  if (to === 'es') {
    from = 'qu';
  }
  const starts = lineStarts(source);
  const replacements: Replacement[] = [];
  for (const token of tokenize(source, from).tokens) {
    const text = translatedText(token, to);
    if (text === null) {
      continue;
    }
    const start = starts[token.position.line - 1] + token.position.column - 1;
    const length = (token.original ?? token.lexeme).length;
    replacements.push({start, length, text});
  }
  let result = source;
  for (const replacement of replacements.reverse()) {
    result = result.slice(0, replacement.start) + replacement.text + result.slice(replacement.start + replacement.length);
  }
  return result;
};
