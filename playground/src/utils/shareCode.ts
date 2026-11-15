const hashPrefix = '#codigo=';

// Convierte el código en texto seguro para la dirección, pasando por UTF-8 para conservar tildes y eñes
export const encodeSource = (source: string): string => {
  const bytes = new TextEncoder().encode(source);
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

// Recupera el código guardado en la dirección, o null si no hay o no se puede leer
export const decodeSource = (encoded: string): string | null => {
  try {
    const binary = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder('utf-8', {fatal: true}).decode(bytes);
  }
  catch {
    return null;
  }
};

// Lee el código del enlace actual
export const sourceFromHash = (hash: string): string | null => {
  if (!hash.startsWith(hashPrefix)) {
    return null;
  }
  return decodeSource(hash.slice(hashPrefix.length));
};

// Arma el enlace que abre el playground con el código indicado
export const shareUrl = (location: Location, source: string): string => {
  return `${location.origin}${location.pathname}${hashPrefix}${encodeSource(source)}`;
};
