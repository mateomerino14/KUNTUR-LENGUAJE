import {useCallback, useState} from 'react';
import {run, runCompiled, type Diagnostic, type Language, type Position, type ReadLine, type StepSnapshot} from '../../../src/index.js';
import {MAX_EXECUTION_STEPS, MAX_TRACE_STEPS} from '../constants/limits';

export type ExecutionMode = 'interpreter' | 'wasm';

export type TranscriptEntry =
  | {kind: 'output'; text: string}
  | {kind: 'input'; prompt: string; answer: string};

export interface TraceStep {
  position: Position;
  snapshot: StepSnapshot;
  transcriptLength: number;
}

export interface Execution {
  source: string;
  input: string;
  mode: ExecutionMode;
  transcript: TranscriptEntry[];
  diagnostics: Diagnostic[];
  trace: TraceStep[];
  traceTruncated: boolean;
  durationMs: number;
}

interface Conversation {
  transcript: TranscriptEntry[];
  write: (line: string) => void;
  read: ReadLine;
}

// Separa la entrada en líneas; un texto vacío no tiene ninguna
const inputLines = (input: string): string[] => {
  if (input === '') {
    return [];
  }
  return input.replace(/\r/g, '').split('\n');
};

// Arma la conversación del programa: lo que muestra y lo que responde la entrada, en orden
const createConversation = (input: string): Conversation => {
  const transcript: TranscriptEntry[] = [];
  const pending = inputLines(input);
  return {
    transcript,
    write: (text) => {
      transcript.push({kind: 'output', text});
    },
    read: (prompt) => {
      const answer = pending.shift();
      if (answer === undefined) {
        return null;
      }
      transcript.push({kind: 'input', prompt, answer});
      return answer;
    },
  };
};

// Ejecuta con el intérprete guardando los primeros pasos para recorrerlos después
const interpretWithTrace = (source: string, input: string, language: Language): Omit<Execution, 'durationMs'> => {
  const conversation = createConversation(input);
  const trace: TraceStep[] = [];
  let traceTruncated = false;
  const result = run(source, {
    language,
    maxSteps: MAX_EXECUTION_STEPS,
    write: conversation.write,
    read: conversation.read,
    onStep: (position, snapshot) => {
      if (trace.length >= MAX_TRACE_STEPS) {
        traceTruncated = true;
        return;
      }
      trace.push({position, snapshot: snapshot(), transcriptLength: conversation.transcript.length});
    },
  });
  return {source, input, mode: 'interpreter', transcript: conversation.transcript, diagnostics: result.diagnostics, trace, traceTruncated};
};

// Compila a WebAssembly y ejecuta con la misma entrada
const runAsWasm = async (source: string, input: string, language: Language): Promise<Omit<Execution, 'durationMs'>> => {
  const conversation = createConversation(input);
  const result = await runCompiled(source, {language, maxSteps: MAX_EXECUTION_STEPS, write: conversation.write, read: conversation.read});
  return {source, input, mode: 'wasm', transcript: conversation.transcript, diagnostics: result.diagnostics, trace: [], traceTruncated: false};
};

export const useExecution = () => {
  const [mode, setMode] = useState<ExecutionMode>('interpreter');
  const [execution, setExecution] = useState<Execution | null>(null);
  const [running, setRunning] = useState(false);

  const execute = useCallback(async (source: string, input: string, requestedMode: ExecutionMode, language: Language) => {
    setRunning(true);
    const start = performance.now();
    try {
      let result: Omit<Execution, 'durationMs'>;
      if (requestedMode === 'interpreter') {
        result = interpretWithTrace(source, input, language);
      }
      else {
        result = await runAsWasm(source, input, language);
      }
      setExecution({...result, durationMs: performance.now() - start});
    }
    finally {
      setRunning(false);
    }
  }, []);

  return {mode, setMode, execution, running, execute};
};
