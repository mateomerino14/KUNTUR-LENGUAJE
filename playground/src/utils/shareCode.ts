import type {Language} from '../../../src/index.js';

const sourceKey = 'codigo';
const inputKey = 'entrada';
const languageKey = 'idioma';
const quechuaValue = 'runasimi';

export interface SharedProgram {
  source: string;
  input: string;
  language: Language;
}

// Convierte el código en texto seguro para la dirección, pasando por UTF-8 para conservar tildes y eñes
const encodeSource = (source: string): string => {
  const bytes = new TextEncoder().encode(source);
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

// Recupera el código guardado en la dirección, o null si no hay o no se puede leer
const decodeSource = (encoded: string): string | null => {
  try {
    const binary = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder('utf-8', {fatal: true}).decode(bytes);
  }
  catch {
    return null;
  }
};

// Lee el código y la entrada del enlace actual, o null si el enlace no trae un programa
export const programFromHash = (hash: string): SharedProgram | null => {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const encodedSource = params.get(sourceKey);
  if (encodedSource === null) {
    return null;
  }
  const source = decodeSource(encodedSource);
  if (source === null) {
    return null;
  }
  const encodedInput = params.get(inputKey);
  let input = '';
  if (encodedInput !== null) {
    input = decodeSource(encodedInput) ?? '';
  }
  let language: Language = 'es';
  if (params.get(languageKey) === quechuaValue) {
    language = 'qu';
  }
  return {source, input, language};
};

// Arma el enlace que abre el playground con el código y la entrada indicados
export const shareUrl = (location: Location, program: SharedProgram): string => {
  let hash = `#${sourceKey}=${encodeSource(program.source)}`;
  if (program.input !== '') {
    hash += `&${inputKey}=${encodeSource(program.input)}`;
  }
  if (program.language === 'qu') {
    hash += `&${languageKey}=${quechuaValue}`;
  }
  return `${location.origin}${location.pathname}${hash}`;
};
