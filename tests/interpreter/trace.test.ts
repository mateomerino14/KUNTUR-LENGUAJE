import {expect, test} from 'vitest';
import {run, type StepSnapshot} from '../../src/index.js';

interface RecordedStep {
  line: number;
  snapshot: StepSnapshot;
}

// Ejecuta el programa y guarda cada paso con su foto de variables
const recordSteps = (source: string): RecordedStep[] => {
  const steps: RecordedStep[] = [];
  run(source, {onStep: (position, snapshot) => steps.push({line: position.line, snapshot: snapshot()})});
  return steps;
};

// Cada sentencia ejecutada genera un paso con su línea
test('registra un paso por cada sentencia ejecutada', () => {
  const steps = recordSteps('var a = 1\nsi a > 0 {\n  a = 2\n}\nmostrar(a)');
  expect(steps.map((step) => step.line)).toEqual([1, 2, 3, 5]);
});

// Las variables muestran su valor como se escribe en el código
test('muestra el valor de las variables en cada paso', () => {
  const steps = recordSteps('var nombre = "Ana"\nvar notas = [70, 85]\nmostrar(nombre)');
  expect(steps[2].snapshot.globals).toEqual([
    {name: 'nombre', value: '"Ana"', kind: 'variable'},
    {name: 'notas', value: '[70, 85]', kind: 'variable'},
  ]);
});

// Dentro de una función se ve la pila de llamadas y las variables locales
test('registra la pila de llamadas y las variables locales', () => {
  const source = 'funcion fact(n: entero): entero {\n  si n <= 1 {\n    retornar 1\n  }\n  retornar n * fact(n - 1)\n}\nmostrar(fact(3))';
  const deepest = recordSteps(source).find((step) => step.line === 3)!;
  expect(deepest.snapshot.callStack).toEqual(['programa', 'fact', 'fact', 'fact']);
  expect(deepest.snapshot.locals).toEqual([{name: 'n', value: '1', kind: 'variable'}]);
});

// La variable del ciclo aparece como tal y tapa a la global del mismo nombre
test('muestra la variable del ciclo y respeta las variables tapadas', () => {
  const steps = recordSteps('var i = 100\npara i desde 1 hasta 2 {\n  mostrar(i)\n}');
  const inside = steps.filter((step) => step.line === 3);
  expect(inside.map((step) => step.snapshot.locals)).toEqual([
    [{name: 'i', value: '1', kind: 'loop'}],
    [{name: 'i', value: '2', kind: 'loop'}],
  ]);
  expect(inside[0].snapshot.globals).toEqual([]);
});
