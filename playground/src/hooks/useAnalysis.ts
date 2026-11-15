import {useEffect, useState} from 'react';
import {check, compile, parse, tokenize, type Diagnostic, type Program, type Token, type TypeInfo} from '../../../src/index.js';
import {ANALYSIS_DELAY_MS} from '../constants/limits';

export interface Analysis {
  source: string;
  tokens: Token[];
  lexerDiagnostics: Diagnostic[];
  program: Program | null;
  parserDiagnostics: Diagnostic[];
  types: TypeInfo | null;
  semanticDiagnostics: Diagnostic[];
  wasmBinary: Uint8Array<ArrayBuffer> | null;
  wasmText: string | null;
  compilerDiagnostics: Diagnostic[];
}

// Pasa el código por cada etapa y se detiene en la primera que falla, como lo hace `run`
const analyze = (source: string): Analysis => {
  const lexed = tokenize(source);
  const analysis: Analysis = {
    source,
    tokens: lexed.tokens,
    lexerDiagnostics: lexed.diagnostics,
    program: null,
    parserDiagnostics: [],
    types: null,
    semanticDiagnostics: [],
    wasmBinary: null,
    wasmText: null,
    compilerDiagnostics: [],
  };
  if (lexed.diagnostics.length > 0) {
    return analysis;
  }
  const parsed = parse(source);
  analysis.program = parsed.program;
  analysis.parserDiagnostics = parsed.diagnostics;
  if (parsed.program === null) {
    return analysis;
  }
  const checked = check(source);
  analysis.types = checked.types;
  analysis.semanticDiagnostics = checked.diagnostics;
  if (checked.program === null) {
    return analysis;
  }
  const compiled = compile(source);
  analysis.wasmBinary = compiled.binary;
  analysis.wasmText = compiled.text;
  analysis.compilerDiagnostics = compiled.diagnostics;
  return analysis;
};

// Diagnósticos que impiden ejecutar: los de la primera etapa que falló
export const blockingDiagnostics = (analysis: Analysis): Diagnostic[] => {
  if (analysis.lexerDiagnostics.length > 0) {
    return analysis.lexerDiagnostics;
  }
  if (analysis.parserDiagnostics.length > 0) {
    return analysis.parserDiagnostics;
  }
  return analysis.semanticDiagnostics;
};

export const useAnalysis = (source: string): Analysis => {
  const [analysis, setAnalysis] = useState(() => analyze(source));

  useEffect(() => {
    if (source === analysis.source) {
      return undefined;
    }
    const timer = window.setTimeout(() => setAnalysis(analyze(source)), ANALYSIS_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [source, analysis.source]);

  return analysis;
};
