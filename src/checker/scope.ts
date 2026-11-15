import type {Position} from '../errors/diagnostic.js';
import type {BuiltinSignature} from './builtinSignatures.js';
import type {Type} from './types.js';

export type SymbolKind = 'variable' | 'constant' | 'loop' | 'function' | 'native';

export interface SymbolInfo {
  name: string;
  type: Type;
  kind: SymbolKind;
  inferred: boolean;
  builtin: BuiltinSignature | null;
  position: Position;
}

export class Scope {
  private readonly symbols = new Map<string, SymbolInfo>();
  readonly parent: Scope | null;

  constructor(parent: Scope | null = null) {
    this.parent = parent;
  }

  // Declara un símbolo en este ámbito; devuelve false si ya existía en él
  define(symbol: SymbolInfo): boolean {
    if (this.symbols.has(symbol.name)) {
      return false;
    }
    this.symbols.set(symbol.name, symbol);
    return true;
  }

  // Busca un símbolo en este ámbito y luego en los que lo contienen
  lookup(name: string): SymbolInfo | undefined {
    const symbol = this.symbols.get(name);
    if (symbol !== undefined) {
      return symbol;
    }
    if (this.parent === null) {
      return undefined;
    }
    return this.parent.lookup(name);
  }

  // Reúne todos los nombres visibles desde este ámbito, para sugerir correcciones
  visibleNames(): Set<string> {
    let names = new Set<string>();
    if (this.parent !== null) {
      names = this.parent.visibleNames();
    }
    for (const name of this.symbols.keys()) {
      names.add(name);
    }
    return names;
  }
}
