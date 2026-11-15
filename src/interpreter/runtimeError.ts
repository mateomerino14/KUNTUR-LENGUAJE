import type {Position} from '../errors/diagnostic.js';

// Error durante la ejecución, con la posición del código que lo provocó
export class RuntimeError extends Error {
  readonly position: Position;

  constructor(message: string, position: Position) {
    super(message);
    this.position = position;
  }
}
