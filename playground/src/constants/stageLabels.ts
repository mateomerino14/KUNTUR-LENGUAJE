import type {Stage} from '../../../src/index.js';

export const STAGE_LABELS: Record<Stage, string> = {
  lexer: 'Error léxico',
  parser: 'Error de sintaxis',
  semantic: 'Error semántico',
  compiler: 'Falta para compilar',
  runtime: 'Error de ejecución',
};
