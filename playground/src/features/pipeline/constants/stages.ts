import type {TabId} from '../../../constants/tabs';

export type StageId = 'lexer' | 'parser' | 'semantic' | 'wasm' | 'run';
export type StageStatus = 'ok' | 'error' | 'warning' | 'pending';

export interface StageDefinition {
  id: StageId;
  name: string;
  colorClass: string;
  stripeClass: string;
  textClass: string;
  tab: TabId;
}

export const STAGES: StageDefinition[] = [
  {id: 'lexer', name: 'Léxico', colorClass: 'bg-fuchsia', stripeClass: '[--stripe:var(--color-mustard)]', textClass: 'text-paper', tab: 'tokens'},
  {id: 'parser', name: 'Sintaxis', colorClass: 'bg-mustard', stripeClass: '[--stripe:var(--color-fuchsia)]', textClass: 'text-ink', tab: 'tree'},
  {id: 'semantic', name: 'Semántica', colorClass: 'bg-teal', stripeClass: '[--stripe:var(--color-mustard)]', textClass: 'text-paper', tab: 'output'},
  {id: 'wasm', name: 'WebAssembly', colorClass: 'bg-violet', stripeClass: '[--stripe:var(--color-teal)]', textClass: 'text-paper', tab: 'wasm'},
  {id: 'run', name: 'Ejecución', colorClass: 'bg-blue', stripeClass: '[--stripe:var(--color-mustard)]', textClass: 'text-paper', tab: 'output'},
];
