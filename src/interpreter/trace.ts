import type {Position} from '../errors/diagnostic.js';
import type {BindingKind, Environment} from './environment.js';
import {stringifyLiteral} from './values.js';

export interface TraceVariable {
  name: string;
  value: string;
  kind: BindingKind;
}

export interface StepSnapshot {
  callStack: string[];
  locals: TraceVariable[];
  globals: TraceVariable[];
}

export type StepListener = (position: Position, snapshot: () => StepSnapshot) => void;

export const programFrameName = 'programa';

// Convierte los nombres de un ámbito en variables para mostrar, sin las funciones ni los ya vistos
const visibleVariables = (scope: Environment, seen: Set<string>): TraceVariable[] => {
  const variables: TraceVariable[] = [];
  for (const [name, binding] of scope.entries()) {
    if (seen.has(name) || binding.kind === 'function' || binding.kind === 'native') {
      continue;
    }
    seen.add(name);
    variables.push({name, value: stringifyLiteral(binding.value), kind: binding.kind});
  }
  return variables;
};

// Toma una foto de las variables visibles: las locales, de adentro hacia afuera, y las globales del programa
export const takeSnapshot = (scope: Environment, globals: Environment, callStack: string[]): StepSnapshot => {
  const seen = new Set<string>();
  const locals: TraceVariable[] = [];
  let current: Environment | null = scope;
  while (current !== null && current !== globals) {
    locals.push(...visibleVariables(current, seen));
    current = current.parent;
  }
  return {callStack: [...callStack], locals, globals: visibleVariables(globals, seen)};
};
