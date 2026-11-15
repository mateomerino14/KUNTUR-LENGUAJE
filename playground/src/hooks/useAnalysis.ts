import {useEffect, useState} from 'react';
import {check, compile, parse, tokenize, type Diagnostic, type Language, type Program, type Token, type TypeInfo} from '../../../src/index.js';
import {ANALYSIS_DELAY_MS} from '../constants/limits';

export interface Analysis {
  source: string;
  language: Language;
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
const analyze = (source: string, language: Language): Analysis => {
  const lexed = tokenize(source, language);
  const analysis: Analysis = {
    source,
    language,
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
  const parsed = parse(source, {language});
  analysis.program = parsed.program;
  analysis.parserDiagnostics = parsed.diagnostics;
  if (parsed.program === null) {
    return analysis;
  }
  const checked = check(source, {language});
  analysis.types = checked.types;
  analysis.semanticDiagnostics = checked.diagnostics;
  if (checked.program === null) {
    return analysis;
  }
  const compiled = compile(source, {language});
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

export const useAnalysis = (source: string, language: Language = 'es'): Analysis => {
  const [analysis, setAnalysis] = useState(() => analyze(source, language));

  useEffect(() => {
    if (source === analysis.source && language === analysis.language) {
      return undefined;
    }
    const timer = window.setTimeout(() => setAnalysis(analyze(source, language)), ANALYSIS_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [source, language, analysis.source, analysis.language]);

  return analysis;
};
