export type Stage = 'lexer' | 'parser' | 'semantic' | 'runtime';

export interface Position {
  line: number;
  column: number;
}

export interface Diagnostic {
  stage: Stage;
  message: string;
  position: Position;
}

const stageLabels: Record<Stage, string> = {
  lexer: 'Error léxico',
  parser: 'Error de sintaxis',
  semantic: 'Error semántico',
  runtime: 'Error de ejecución',
};

const gutterSeparator = ' | ';

// Crea un diagnóstico copiando la posición para que no se comparta entre etapas
export const createDiagnostic = (stage: Stage, message: string, position: Position): Diagnostic => {
  return {stage, message, position: {line: position.line, column: position.column}};
};

// Devuelve la línea del código fuente indicada, contando desde 1
const getSourceLine = (source: string, line: number): string | null => {
  const lines = source.split(/\r?\n/);
  if (line < 1 || line > lines.length) {
    return null;
  }
  return lines[line - 1];
};

// Da formato legible a un diagnóstico, con la línea del código y una señal bajo la columna
export const formatDiagnostic = (diagnostic: Diagnostic, source?: string): string => {
  const {line, column} = diagnostic.position;
  const header = `${stageLabels[diagnostic.stage]} en la línea ${line}, columna ${column}:`;
  if (source === undefined) {
    return `${header}\n${diagnostic.message}`;
  }
  const sourceLine = getSourceLine(source, line);
  if (sourceLine === null) {
    return `${header}\n${diagnostic.message}`;
  }
  const lineLabel = String(line);
  const emptyGutter = ' '.repeat(lineLabel.length);
  const pointer = ' '.repeat(Math.max(column - 1, 0)) + '^';
  return [
    header,
    `  ${lineLabel}${gutterSeparator}${sourceLine}`,
    `  ${emptyGutter}${gutterSeparator}${pointer}`,
    diagnostic.message,
  ].join('\n');
};
