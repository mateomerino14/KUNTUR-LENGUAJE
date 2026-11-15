const lowSevenBits = 0x7f;
const continuationBit = 0x80;
const signBit = 0x40;
const bitsPerByte = 7;
const f64ByteLength = 8;

const textEncoder = new TextEncoder();

// Codifica un entero sin signo en LEB128, el formato de largo variable de WebAssembly
export const encodeUnsigned = (value: number): number[] => {
  const bytes: number[] = [];
  let remaining = value >>> 0;
  do {
    let byte = remaining & lowSevenBits;
    remaining >>>= bitsPerByte;
    if (remaining !== 0) {
      byte |= continuationBit;
    }
    bytes.push(byte);
  } while (remaining !== 0);
  return bytes;
};

// Codifica un entero de 32 bits con signo en LEB128
export const encodeSigned = (value: number): number[] => {
  const bytes: number[] = [];
  let remaining = value | 0;
  while (true) {
    const byte = remaining & lowSevenBits;
    remaining >>= bitsPerByte;
    const signBitClear = (byte & signBit) === 0;
    if ((remaining === 0 && signBitClear) || (remaining === -1 && !signBitClear)) {
      bytes.push(byte);
      return bytes;
    }
    bytes.push(byte | continuationBit);
  }
};

// Codifica un entero de 64 bits con signo en LEB128
export const encodeSigned64 = (value: bigint): number[] => {
  const bytes: number[] = [];
  let remaining = BigInt.asIntN(64, value);
  while (true) {
    const byte = Number(remaining & 0x7fn);
    remaining >>= 7n;
    const signBitClear = (byte & signBit) === 0;
    if ((remaining === 0n && signBitClear) || (remaining === -1n && !signBitClear)) {
      bytes.push(byte);
      return bytes;
    }
    bytes.push(byte | continuationBit);
  }
};

// Codifica un número de punto flotante de 64 bits en orden little-endian
export const encodeF64 = (value: number): number[] => {
  const buffer = new ArrayBuffer(f64ByteLength);
  new DataView(buffer).setFloat64(0, value, true);
  return Array.from(new Uint8Array(buffer));
};

// Convierte un texto en sus bytes UTF-8
export const utf8Bytes = (text: string): number[] => Array.from(textEncoder.encode(text));

// Codifica un nombre: su largo en bytes seguido de sus bytes UTF-8
export const encodeName = (text: string): number[] => {
  const bytes = utf8Bytes(text);
  return [...encodeUnsigned(bytes.length), ...bytes];
};

// Codifica una lista de elementos ya codificados, precedida por su cantidad
export const encodeVector = (items: number[][]): number[] => {
  return [...encodeUnsigned(items.length), ...items.flat()];
};

// Codifica una sección con su identificador y su tamaño en bytes
export const encodeSection = (id: number, content: number[]): number[] => {
  return [id, ...encodeUnsigned(content.length), ...content];
};
