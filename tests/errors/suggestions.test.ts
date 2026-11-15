import {expect, test} from 'vitest';
import {editDistance, suggestName, withSuggestion} from '../../src/errors/suggestions.js';

// La distancia cuenta inserciones, borrados y reemplazos
test('calcula la distancia entre dos palabras', () => {
  expect(editDistance('edad', 'edad')).toBe(0);
  expect(editDistance('edda', 'edad')).toBe(2);
  expect(editDistance('mostar', 'mostrar')).toBe(1);
});

// Sugiere el nombre más parecido entre los disponibles
test('sugiere el nombre más parecido', () => {
  expect(suggestName('mostar', ['mostrar', 'longitud', 'texto'])).toBe('mostrar');
  expect(suggestName('contdor', ['contador', 'total'])).toBe('contador');
});

// No sugiere nombres que no se parecen
test('no sugiere nombres sin relación', () => {
  expect(suggestName('x', ['contador', 'total'])).toBeNull();
});

// Agrega la pregunta al mensaje solo cuando hay sugerencia
test('agrega la sugerencia al mensaje', () => {
  expect(withSuggestion('No existe.', 'mostar', ['mostrar'])).toBe('No existe. ¿Quisiste decir `mostrar`?');
  expect(withSuggestion('No existe.', 'zzz', ['mostrar'])).toBe('No existe.');
});
