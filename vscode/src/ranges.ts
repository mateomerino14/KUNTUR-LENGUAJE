const tokenPattern = /"(?:[^"\\]|\\.)*"?|[\p{L}_](?:[\p{L}\p{N}_]|['’](?=\p{L}))*|\d+(?:\.\d+)?|[=!<>]=|\S/uy;

export interface ColumnRange {
  start: number;
  end: number;
}

// Rango del token que empieza en la columna indicada (contada desde 1), en columnas contadas desde 0 para el editor
export const tokenColumns = (line: string, column: number): ColumnRange => {
  const start = Math.min(Math.max(column - 1, 0), line.length);
  tokenPattern.lastIndex = start;
  const match = tokenPattern.exec(line);
  if (match === null) {
    return {start, end: Math.min(start + 1, Math.max(line.length, start + 1))};
  }
  return {start, end: start + match[0].length};
};
