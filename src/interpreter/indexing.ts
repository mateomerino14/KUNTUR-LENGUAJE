import type {Position} from '../errors/diagnostic.js';
import {dictKeyMessage, emptyIndexMessage, indexOutOfRangeMessage, missingKeyMessage} from '../errors/messages.js';
import {RuntimeError} from './runtimeError.js';
import {describeType, type Dict, type Value} from './values.js';

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
    throw new RuntimeError(emptyIndexMessage(String(index)), position);
  }
  if (index < 0 || index >= length) {
    throw new RuntimeError(indexOutOfRangeMessage(String(index), String(length), String(length - 1)), position);
  }
  return index;
};

// Verifica que la clave de un diccionario sea un texto y la devuelve
export const checkKey = (key: Value, position: Position): string => {
  if (typeof key !== 'string') {
    throw new RuntimeError(dictKeyMessage(describeType(key)), position);
  }
  return key;
};

// Lee el valor de una clave y explica el error si el diccionario no la tiene
export const readKey = (dict: Dict, key: Value, position: Position): Value => {
  const text = checkKey(key, position);
  if (!dict.has(text)) {
    throw new RuntimeError(missingKeyMessage(JSON.stringify(text)), position);
  }
  return dict.get(text)!;
};
