export type Language = 'es' | 'qu';

export const LANGUAGES: {id: Language; label: string}[] = [
  {id: 'es', label: 'Español'},
  {id: 'qu', label: 'Runasimi'},
];

// Cada palabra en quechua con la palabra en español a la que equivale
export const QUECHUA_WORDS: ReadonlyMap<string, string> = new Map([
  ['kay', 'var'],
  ['mana tikraq', 'constante'],
  ['ruray', 'funcion'],
  ['kutichiy', 'retornar'],
  ['sichus', 'si'],
  ['manachus', 'sino'],
  ['kaykama', 'mientras'],
  ['sapanka', 'para'],
  ['qallarispa', 'desde'],
  ['kama', 'hasta'],
  ["p'akiy", 'romper'],
  ['qatiy', 'continuar'],
  ['cheqaq', 'verdadero'],
  ['llulla', 'falso'],
  ["ch'usaq", 'nulo'],
  ['chantapas', 'y'],
  ['utaq', 'o'],
  ['mana', 'no'],
  ['rikuchiy', 'mostrar'],
  ['tapuy', 'leer'],
]);

const SPANISH_TO_QUECHUA: ReadonlyMap<string, string> = new Map([
  ...[...QUECHUA_WORDS].map(([quechua, spanish]): [string, string] => [spanish, quechua]),
  ['función', 'ruray'],
]);

const constantFirst = 'mana';
const constantSecond = 'tikraq';

// Palabra en quechua que corresponde a una palabra en español, o la misma si no tiene equivalente
export const toQuechua = (word: string): string => SPANISH_TO_QUECHUA.get(word) ?? word;

// Si el texto sigue con la segunda parte de `mana tikraq`, devuelve cuántos caracteres ocupa; si no, 0
export const constantTailLength = (word: string, rest: string): number => {
  if (word !== constantFirst) {
    return 0;
  }
  const match = new RegExp(`^[ \\t]+${constantSecond}(?![\\p{L}\\p{N}_'])`, 'u').exec(rest);
  if (match === null) {
    return 0;
  }
  return match[0].length;
};

// Pasa a quechua las palabras del lenguaje que aparecen entre comillas invertidas en un mensaje
export const localizeMessage = (message: string, language: Language): string => {
  if (language === 'es') {
    return message;
  }
  return message.replace(/`[^`]*`/g, (code) => code.replace(/[\p{L}_][\p{L}\p{N}_]*/gu, (word) => toQuechua(word)));
};
