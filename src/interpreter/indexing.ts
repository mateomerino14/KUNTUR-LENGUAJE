import type {Position} from '../errors/diagnostic.js';
import {RuntimeError} from './runtimeError.js';
import {describeType, type Value} from './values.js';

// Muestra el número entre paréntesis cuando ayuda a entender el error
const showNumber = (value: Value): string => {
  if (typeof value === 'number') {
    return ` (${value})`;
  }
  return '';
};

// Verifica que la posición sea un entero dentro del rango y la devuelve
export const checkIndex = (index: Value, length: number, position: Position): number => {
  if (typeof index !== 'number' || !Number.isInteger(index)) {
    throw new RuntimeError(
      `La posición debe ser un número entero, pero aquí es ${describeType(index)}${showNumber(index)}.`,
      position,
    );
  }
  if (length === 0) {
    throw new RuntimeError(`La posición ${index} no existe: no hay ningún elemento.`, position);
  }
  if (index < 0 || index >= length) {
    throw new RuntimeError(
      `La posición ${index} no existe: hay ${length} elementos, en las posiciones 0 a ${length - 1}.`,
      position,
    );
  }
  return index;
};
