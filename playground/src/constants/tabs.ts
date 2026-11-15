export type TabId = 'output' | 'tokens' | 'tree' | 'wasm' | 'stepper';

export interface TabDefinition {
  id: TabId;
  label: string;
}

export const TABS: TabDefinition[] = [
  {id: 'output', label: 'Salida'},
  {id: 'tokens', label: 'Tokens'},
  {id: 'tree', label: 'Árbol'},
  {id: 'wasm', label: 'WebAssembly'},
  {id: 'stepper', label: 'Paso a paso'},
];
