import factorial from '../../../ejemplos/factorial.kun?raw';
import fizzbuzz from '../../../ejemplos/fizzbuzz.kun?raw';
import hola from '../../../ejemplos/hola.kun?raw';
import listas from '../../../ejemplos/listas.kun?raw';
import primos from '../../../ejemplos/primos.kun?raw';
import tipos from '../../../ejemplos/tipos.kun?raw';
import error from '../../../ejemplos/error.kun?raw';

export interface Example {
  id: string;
  name: string;
  source: string;
}

export const EXAMPLES: Example[] = [
  {id: 'hola', name: 'Hola, Cochabamba', source: hola},
  {id: 'tipos', name: 'Notas de un curso', source: tipos},
  {id: 'factorial', name: 'Factorial', source: factorial},
  {id: 'fizzbuzz', name: 'Chuño y charque', source: fizzbuzz},
  {id: 'listas', name: 'Ordenar precios', source: listas},
  {id: 'primos', name: 'Números primos', source: primos},
  {id: 'error', name: 'Un error a propósito', source: error},
];

export const DEFAULT_EXAMPLE = EXAMPLES[1];
