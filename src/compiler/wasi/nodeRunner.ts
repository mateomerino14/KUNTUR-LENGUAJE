import {closeSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WASI} from 'node:wasi';

export interface WasiRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

// Ejecuta un módulo WASI en Node con la entrada indicada y devuelve lo que escribió y su código de salida
export const runWasiModule = async (binary: Uint8Array<ArrayBuffer>, input = ''): Promise<WasiRunResult> => {
  const directory = mkdtempSync(join(tmpdir(), 'kuntur-wasi-'));
  const paths = {stdin: join(directory, 'entrada'), stdout: join(directory, 'salida'), stderr: join(directory, 'errores')};
  writeFileSync(paths.stdin, input);
  const descriptors = {
    stdin: openSync(paths.stdin, 'r'),
    stdout: openSync(paths.stdout, 'w'),
    stderr: openSync(paths.stderr, 'w'),
  };
  try {
    const wasi = new WASI({version: 'preview1', returnOnExit: true, ...descriptors});
    const {instance} = await WebAssembly.instantiate(binary, wasi.getImportObject() as WebAssembly.Imports);
    const exitCode = wasi.start(instance);
    return {
      stdout: readFileSync(paths.stdout, 'utf8'),
      stderr: readFileSync(paths.stderr, 'utf8'),
      exitCode,
    };
  }
  finally {
    Object.values(descriptors).forEach((descriptor) => closeSync(descriptor));
    rmSync(directory, {recursive: true, force: true});
  }
};
