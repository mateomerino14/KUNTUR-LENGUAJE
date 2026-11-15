import factorial from '../../../ejemplos/factorial.kun?raw';
import fizzbuzz from '../../../ejemplos/fizzbuzz.kun?raw';
import hola from '../../../ejemplos/hola.kun?raw';
import listas from '../../../ejemplos/listas.kun?raw';
import primos from '../../../ejemplos/primos.kun?raw';
import tipos from '../../../ejemplos/tipos.kun?raw';
import error from '../../../ejemplos/error.kun?raw';
import promedioInput from '../../../ejemplos/promedio.entrada?raw';
import promedio from '../../../ejemplos/promedio.kun?raw';

export type ExampleGroup = 'start' | 'types' | 'input' | 'classics';

export interface Example {
  id: string;
  name: string;
  description: string;
  group: ExampleGroup;
  source: string;
  input: string;
}

export const EXAMPLE_GROUPS: {id: ExampleGroup; label: string}[] = [
  {id: 'start', label: 'Para empezar'},
  {id: 'types', label: 'Con tipos'},
  {id: 'input', label: 'Con datos de entrada'},
  {id: 'classics', label: 'Clásicos'},
];

export const EXAMPLES: Example[] = [
  {id: 'hola', name: 'Hola, Cochabamba', description: 'Un saludo con una variable', group: 'start', source: hola, input: ''},
  {id: 'error', name: 'Un error a propósito', description: 'Mira cómo Kuntur explica un error', group: 'start', source: error, input: ''},
  {id: 'tipos', name: 'Notas de un curso', description: 'Funciones, listas de listas y promedios', group: 'types', source: tipos, input: ''},
  {id: 'listas', name: 'Ordenar precios', description: 'El método de la burbuja sobre una lista', group: 'types', source: listas, input: ''},
  {id: 'promedio', name: 'Promedio con leer()', description: 'Pide las notas una por una', group: 'input', source: promedio, input: promedioInput},
  {id: 'factorial', name: 'Factorial', description: 'Recursión y ciclo, lado a lado', group: 'classics', source: factorial, input: ''},
  {id: 'fizzbuzz', name: 'Chuño y charque', description: 'FizzBuzz con sabor cochabambino', group: 'classics', source: fizzbuzz, input: ''},
  {id: 'primos', name: 'Números primos', description: 'La criba de Eratóstenes hasta 50', group: 'classics', source: primos, input: ''},
];

export const DEFAULT_EXAMPLE = EXAMPLES.find((example) => example.id === 'tipos')!;
