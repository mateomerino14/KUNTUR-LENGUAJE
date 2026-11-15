import {createDiagnostic, type Diagnostic} from '../errors/diagnostic.js';
import {tooDeepMessage} from '../errors/messages.js';
import {defaultMaxSteps} from '../interpreter/interpreter.js';
import {RuntimeError} from '../interpreter/runtimeError.js';
import {mainFunctionName, memoryExportName} from './codegen.js';
import {createHostFunctions, hostModuleName} from './host.js';

export interface WasmRunOptions {
  write: (line: string) => void;
  maxSteps?: number;
  random?: () => number;
}

// Instancia el módulo con las funciones del anfitrión, ejecuta `principal` y convierte los errores en diagnósticos
export const runWasm = async (binary: Uint8Array<ArrayBuffer>, options: WasmRunOptions): Promise<Diagnostic[]> => {
  let memory: WebAssembly.Memory | null = null;
  const host = createHostFunctions({
    write: options.write,
    random: options.random ?? Math.random,
    maxSteps: options.maxSteps ?? defaultMaxSteps,
    memory: () => memory!,
  });
  const {instance} = await WebAssembly.instantiate(binary, {[hostModuleName]: host});
  memory = instance.exports[memoryExportName] as WebAssembly.Memory;
  const main = instance.exports[mainFunctionName] as () => void;
  try {
    main();
    return [];
  }
  catch (error) {
    if (error instanceof RuntimeError) {
      return [createDiagnostic('runtime', error.message, error.position)];
    }
    // El motor se quedó sin pila antes de llegar al límite propio de llamadas
    if (error instanceof RangeError) {
      return [createDiagnostic('runtime', tooDeepMessage(), {line: 1, column: 1})];
    }
    throw error;
  }
};
