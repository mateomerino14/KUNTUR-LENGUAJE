import {readSync} from 'node:fs';
import type {ReadLine} from './interpreter/builtins.js';

const standardInput = 0;
const chunkSize = 4096;
const retryCodes = new Set(['EAGAIN']);
const endCodes = new Set(['EOF']);

// Lee bytes de la entrada estándar sin esperar eventos; devuelve 0 al terminar la entrada
const readChunk = (buffer: Buffer): number => {
  while (true) {
    try {
      return readSync(standardInput, buffer, 0, buffer.length, null);
    }
    catch (error) {
      const code = (error as NodeJS.ErrnoException).code ?? '';
      if (endCodes.has(code)) {
        return 0;
      }
      if (!retryCodes.has(code)) {
        throw error;
      }
    }
  }
};

// Crea la fuente de `leer` para la terminal: muestra la pregunta y espera una línea de la entrada estándar
export const createStdinReader = (output: NodeJS.WriteStream): ReadLine => {
  const buffer = Buffer.alloc(chunkSize);
  const decoder = new TextDecoder();
  // Si la entrada viene de un archivo o una tubería, la respuesta no se ve: se repite para que la conversación se lea completa.
  // Quien ya muestra lo que se escribe, como la terminal de la extensión de VS Code, lo apaga con KUNTUR_ECO=0
  const echoAnswers = !process.stdin.isTTY && process.env.KUNTUR_ECO !== '0';
  let pending = '';
  let ended = false;
  return (prompt) => {
    output.write(prompt);
    while (!pending.includes('\n') && !ended) {
      const bytes = readChunk(buffer);
      if (bytes === 0) {
        ended = true;
      }
      else {
        pending += decoder.decode(buffer.subarray(0, bytes), {stream: true});
      }
    }
    if (pending === '' && ended) {
      output.write('\n');
      return null;
    }
    let line = pending;
    const newline = pending.indexOf('\n');
    if (newline === -1) {
      pending = '';
    }
    else {
      line = pending.slice(0, newline);
      pending = pending.slice(newline + 1);
    }
    const answer = line.replace(/\r$/, '');
    if (echoAnswers) {
      output.write(`${answer}\n`);
    }
    return answer;
  };
};
