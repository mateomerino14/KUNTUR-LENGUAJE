import type {Text} from '@codemirror/state';

export interface SourceRange {
  from: number;
  to: number;
}

const tokenPattern = /"(?:[^"\\\n]|\\.)*"?|[\p{L}\p{N}_.]+|[=!<>]=|\S/u;

// Convierte una línea y columna, contadas desde 1, en una posición dentro del documento
const offsetOf = (doc: Text, line: number, column: number): number => {
  const safeLine = Math.min(Math.max(line, 1), doc.lines);
  const lineInfo = doc.line(safeLine);
  return Math.min(lineInfo.from + Math.max(column - 1, 0), lineInfo.to);
};

// Calcula el rango del token que empieza en la línea y columna indicadas, para subrayarlo o seleccionarlo
export const tokenRangeAt = (doc: Text, line: number, column: number): SourceRange => {
  const from = offsetOf(doc, line, column);
  const lineInfo = doc.lineAt(from);
  const rest = doc.sliceString(from, lineInfo.to);
  const match = tokenPattern.exec(rest);
  if (match === null || match.index !== 0) {
    return {from, to: Math.min(from + 1, doc.length)};
  }
  return {from, to: from + match[0].length};
};
