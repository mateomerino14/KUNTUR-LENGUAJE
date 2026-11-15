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
const runReport = (analysis: Analysis, execution: Execution | null, running: boolean, mode: ExecutionMode): StageReport => {
  if (running) {
    return {status: 'pending', summary: 'ejecutando'};
  }
  if (execution === null) {
    return {status: 'pending', summary: 'sin ejecutar'};
  }
  if (execution.source !== analysis.source || execution.mode !== mode) {
    return {status: 'pending', summary: 'el código cambió'};
  }
  if (execution.diagnostics.length > 0) {
    return errorReport(execution.diagnostics.length);
  }
  return {status: 'ok', summary: `${plural(execution.output.length, 'línea', 'líneas')} en ${Math.max(1, Math.round(execution.durationMs))} ms`};
};

// Calcula el estado de cada etapa a partir del análisis y de la última ejecución
export const stageReports = (analysis: Analysis, execution: Execution | null, running: boolean, mode: ExecutionMode): Record<StageId, StageReport> => {
  const reports: Record<StageId, StageReport> = {
    lexer: pendingReport,
    parser: pendingReport,
    semantic: pendingReport,
    wasm: pendingReport,
    run: runReport(analysis, execution, running, mode),
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
