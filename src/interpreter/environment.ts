import type {Value} from './values.js';

export type BindingKind = 'variable' | 'constant' | 'loop' | 'function' | 'native';

export interface Binding {
  value: Value;
  kind: BindingKind;
}

export class Environment {
  private readonly bindings = new Map<string, Binding>();
  readonly parent: Environment | null;

  constructor(parent: Environment | null = null) {
    this.parent = parent;
  }

  // Declara un nombre en este ámbito; devuelve false si ya existía en él
  define(name: string, value: Value, kind: BindingKind): boolean {
    if (this.bindings.has(name)) {
      return false;
    }
    this.bindings.set(name, {value, kind});
    return true;
  }

  // Busca un nombre en este ámbito y luego en los que lo contienen
  lookup(name: string): Binding | undefined {
    const binding = this.bindings.get(name);
    if (binding !== undefined) {
      return binding;
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
    for (const name of this.bindings.keys()) {
      names.add(name);
    }
    return names;
  }
}
