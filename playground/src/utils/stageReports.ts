import type {GradeResult} from '../../../src/index.js';
import type {StageId, StageStatus} from '../features/pipeline/constants/stages';
import type {Analysis} from '../hooks/useAnalysis';
import type {Execution, ExecutionMode} from '../hooks/useExecution';
import {plural} from './plural';

export interface StageReport {
  status: StageStatus;
  summary: string;
}

const pendingReport: StageReport = {status: 'pending', summary: 'sin revisar'};

// Resume una etapa con errores
const errorReport = (count: number): StageReport => ({status: 'error', summary: plural(count, 'error', 'errores')});

// Resume la ejecución: si no corrió, si el código cambió después, o cómo terminó
const runReport = (analysis: Analysis, input: string, execution: Execution | null, running: boolean, mode: ExecutionMode): StageReport => {
  if (running) {
    return {status: 'pending', summary: 'ejecutando'};
  }
  if (execution === null) {
    return {status: 'pending', summary: 'sin ejecutar'};
  }
  if (execution.source !== analysis.source || execution.mode !== mode) {
    return {status: 'pending', summary: 'el código cambió'};
  }
  if (execution.input !== input) {
    return {status: 'pending', summary: 'la entrada cambió'};
  }
  if (execution.diagnostics.length > 0) {
    return errorReport(execution.diagnostics.length);
  }
  const lines = execution.transcript.filter((entry) => entry.kind === 'output').length;
  return {status: 'ok', summary: `${plural(lines, 'línea', 'líneas')} en ${Math.max(1, Math.round(execution.durationMs))} ms`};
};

// Calcula el estado de cada etapa a partir del análisis y de la última ejecución
export const stageReports = (
  analysis: Analysis,
  input: string,
  execution: Execution | null,
  running: boolean,
  mode: ExecutionMode,
): Record<StageId, StageReport> => {
  const reports: Record<StageId, StageReport> = {
    lexer: pendingReport,
    parser: pendingReport,
    semantic: pendingReport,
    wasm: pendingReport,
    run: runReport(analysis, input, execution, running, mode),
  };
  if (analysis.lexerDiagnostics.length > 0) {
    reports.lexer = errorReport(analysis.lexerDiagnostics.length);
    return reports;
  }
  reports.lexer = {status: 'ok', summary: plural(analysis.tokens.length, 'token', 'tokens')};
  if (analysis.program === null) {
    reports.parser = errorReport(analysis.parserDiagnostics.length);
    return reports;
  }
  reports.parser = {status: 'ok', summary: plural(analysis.program.statements.length, 'sentencia', 'sentencias')};
  if (analysis.semanticDiagnostics.length > 0) {
    reports.semantic = errorReport(analysis.semanticDiagnostics.length);
    return reports;
  }
  reports.semantic = {status: 'ok', summary: 'tipos correctos'};
  if (analysis.wasmBinary === null) {
    reports.wasm = {status: 'warning', summary: 'faltan tipos para compilar'};
  }
  else {
    reports.wasm = {status: 'ok', summary: plural(analysis.wasmBinary.length, 'byte', 'bytes')};
  }
  return reports;
};

// Resume la corrección de un ejercicio en la etapa de ejecución de la franja
export const gradeReport = (grade: GradeResult | null, gradeIsStale: boolean): StageReport => {
  if (gradeIsStale) {
    return {status: 'pending', summary: 'el código cambió'};
  }
  if (grade === null || grade.blocking.length > 0) {
    return {status: 'pending', summary: 'sin comprobar'};
  }
  const passed = grade.results.filter((result) => result.outcome === 'passed').length;
  const summary = `${passed} de ${plural(grade.results.length, 'caso', 'casos')}`;
  if (grade.solved) {
    return {status: 'ok', summary};
  }
  return {status: 'error', summary};
};
