import {expect, test} from 'vitest';
import {createDiagnostic, formatDiagnostic} from '../../src/errors/diagnostic.js';

// El formato muestra la línea del código y una señal bajo la columna
test('muestra la línea del código y señala la columna', () => {
  const diagnostic = createDiagnostic('parser', 'Falta algo.', {line: 2, column: 5});
  expect(formatDiagnostic(diagnostic, 'var a = 1\nsi a > {\n}')).toBe([
    'Error de sintaxis en la línea 2, columna 5:',
    '  2 | si a > {',
    '    |     ^',
    'Falta algo.',
  ].join('\n'));
});

// Sin código fuente solo muestra el encabezado y el mensaje
test('funciona sin el código fuente', () => {
  const diagnostic = createDiagnostic('runtime', 'Falló.', {line: 1, column: 1});
  expect(formatDiagnostic(diagnostic)).toBe('Error de ejecución en la línea 1, columna 1:\nFalló.');
});
