import type {Diagnostic} from '../errors/diagnostic.js';
import {check, run} from '../index.js';
import type {Exercise, TestCase} from './catalog.js';

export type TestOutcome = 'passed' | 'wrong-output' | 'runtime-error';

export interface TestResult {
  test: TestCase;
  outcome: TestOutcome;
  actual: string[];
  diagnostics: Diagnostic[];
}

export interface GradeResult {
  blocking: Diagnostic[];
  results: TestResult[];
  solved: boolean;
}

const gradingMaxSteps = 1_000_000;

// Compara dos salidas línea por línea, sin tomar en cuenta los espacios al final de cada línea
const sameOutput = (expected: string[], actual: string[]): boolean => {
  if (expected.length !== actual.length) {
    return false;
  }
  return expected.every((line, index) => line.trimEnd() === actual[index].trimEnd());
};

// Ejecuta el programa con la entrada de un caso y compara lo que muestra con lo esperado
const runTest = (source: string, test: TestCase): TestResult => {
  const pending = [...test.input];
  const {output, diagnostics} = run(source, {maxSteps: gradingMaxSteps, read: () => pending.shift() ?? null});
  if (diagnostics.length > 0) {
    return {test, outcome: 'runtime-error', actual: output, diagnostics};
  }
  if (!sameOutput(test.output, output)) {
    return {test, outcome: 'wrong-output', actual: output, diagnostics};
  }
  return {test, outcome: 'passed', actual: output, diagnostics};
};

// Corrige un ejercicio: si el programa tiene errores antes de ejecutar no corre ningún caso
export const gradeExercise = (source: string, exercise: Exercise): GradeResult => {
  const checked = check(source);
  if (checked.diagnostics.length > 0) {
    return {blocking: checked.diagnostics, results: [], solved: false};
  }
  const results = exercise.tests.map((test) => runTest(source, test));
  return {blocking: [], results, solved: results.every((result) => result.outcome === 'passed')};
};

// Primera línea en que difieren la salida esperada y la obtenida, para señalarla
export const firstDifference = (expected: string[], actual: string[]): number => {
  const length = Math.max(expected.length, actual.length);
  for (let index = 0; index < length; index++) {
    const expectedLine = expected[index];
    const actualLine = actual[index];
    if (expectedLine === undefined || actualLine === undefined || expectedLine.trimEnd() !== actualLine.trimEnd()) {
      return index;
    }
  }
  return -1;
};
