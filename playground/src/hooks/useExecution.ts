import {useCallback, useState} from 'react';
import {run, runCompiled, type Diagnostic, type Position, type StepSnapshot} from '../../../src/index.js';
import {MAX_EXECUTION_STEPS, MAX_TRACE_STEPS} from '../constants/limits';

export type ExecutionMode = 'interpreter' | 'wasm';

export interface TraceStep {
  position: Position;
  snapshot: StepSnapshot;
  outputLength: number;
}

export interface Execution {
  source: string;
  mode: ExecutionMode;
  output: string[];
  diagnostics: Diagnostic[];
  trace: TraceStep[];
  traceTruncated: boolean;
  durationMs: number;
}

// Ejecuta con el intérprete guardando los primeros pasos para recorrerlos después
const interpretWithTrace = (source: string): Omit<Execution, 'durationMs'> => {
  const trace: TraceStep[] = [];
  let outputLength = 0;
  let traceTruncated = false;
  const result = run(source, {
    maxSteps: MAX_EXECUTION_STEPS,
    write: () => {
      outputLength++;
    },
    onStep: (position, snapshot) => {
      if (trace.length >= MAX_TRACE_STEPS) {
        traceTruncated = true;
        return;
      }
      trace.push({position, snapshot: snapshot(), outputLength});
    },
  });
  return {source, mode: 'interpreter', output: result.output, diagnostics: result.diagnostics, trace, traceTruncated};
};

export const useExecution = () => {
  const [mode, setMode] = useState<ExecutionMode>('interpreter');
  const [execution, setExecution] = useState<Execution | null>(null);
  const [running, setRunning] = useState(false);

  const execute = useCallback(async (source: string, requestedMode: ExecutionMode) => {
    setRunning(true);
    const start = performance.now();
    try {
      if (requestedMode === 'interpreter') {
        const result = interpretWithTrace(source);
        setExecution({...result, durationMs: performance.now() - start});
      }
      else {
        const result = await runCompiled(source, {maxSteps: MAX_EXECUTION_STEPS});
        setExecution({
          source,
          mode: 'wasm',
          output: result.output,
          diagnostics: result.diagnostics,
          trace: [],
          traceTruncated: false,
          durationMs: performance.now() - start,
        });
      }
    }
    finally {
      setRunning(false);
    }
  }, []);

  return {mode, setMode, execution, running, execute};
};
