import factorial from '../../../ejemplos/factorial.kun?raw';
import fizzbuzz from '../../../ejemplos/fizzbuzz.kun?raw';
import hola from '../../../ejemplos/hola.kun?raw';
import listas from '../../../ejemplos/listas.kun?raw';
import primos from '../../../ejemplos/primos.kun?raw';
import tipos from '../../../ejemplos/tipos.kun?raw';
import error from '../../../ejemplos/error.kun?raw';
import promedioInput from '../../../ejemplos/promedio.entrada?raw';
import promedio from '../../../ejemplos/promedio.kun?raw';

export interface Example {
  id: string;
  name: string;
  source: string;
  input: string;
}

export const EXAMPLES: Example[] = [
  {id: 'hola', name: 'Hola, Cochabamba', source: hola, input: ''},
  {id: 'tipos', name: 'Notas de un curso', source: tipos, input: ''},
  {id: 'promedio', name: 'Promedio con leer()', source: promedio, input: promedioInput},
  {id: 'factorial', name: 'Factorial', source: factorial, input: ''},
  {id: 'fizzbuzz', name: 'Chuño y charque', source: fizzbuzz, input: ''},
  {id: 'listas', name: 'Ordenar precios', source: listas, input: ''},
  {id: 'primos', name: 'Números primos', source: primos, input: ''},
  {id: 'error', name: 'Un error a propósito', source: error, input: ''},
];

export const DEFAULT_EXAMPLE = EXAMPLES[1];
