import {expect, test} from 'vitest';
import {run, type ReadLine} from '../../src/index.js';

// Fuente de entrada que entrega las líneas en orden y guarda las preguntas recibidas
const linesReader = (lines: string[], prompts: string[] = []): ReadLine => {
  const pending = [...lines];
  return (prompt) => {
    prompts.push(prompt);
    return pending.shift() ?? null;
  };
};

// `leer` devuelve cada línea como texto y recibe la pregunta
test('lee las líneas de entrada en orden', () => {
  const prompts: string[] = [];
  const source = 'var nombre = leer("Nombre: ")\nvar edad = numero(leer("Edad: "))\nmostrar(nombre, edad + 1, tipo(nombre))';
  const {output, diagnostics} = run(source, {read: linesReader(['Ana', '20'], prompts)});
  expect(diagnostics).toEqual([]);
  expect(output).toEqual(['Ana 21 texto']);
  expect(prompts).toEqual(['Nombre: ', 'Edad: ']);
});

// Una línea vacía es un texto vacío, no el final de la entrada
test('distingue una línea vacía del final de la entrada', () => {
  const {output} = run('mostrar(longitud(leer("")))', {read: linesReader([''])});
  expect(output).toEqual(['0']);
});

// Al acabarse la entrada se informa dónde se pidió el dato
test('informa cuando ya no hay más datos de entrada', () => {
  const {diagnostics} = run('var a = leer("a")\nvar b = leer("b")', {read: linesReader(['1'])});
  expect(diagnostics).toHaveLength(1);
  expect(diagnostics[0].message).toBe('El programa pidió un dato con `leer`, pero ya no hay más datos de entrada.');
  expect(diagnostics[0].position).toEqual({line: 2, column: 9});
});

// Sin fuente de entrada, `leer` no tiene datos
test('no tiene datos si no se indica una entrada', () => {
  expect(run('leer("x")').diagnostics[0].message).toContain('ya no hay más datos de entrada');
});

// La pregunta debe ser un texto, y el resultado es un texto
test('revisa los tipos de leer antes de ejecutar', () => {
  expect(run('leer(5)').diagnostics[0].message).toBe('`leer` necesita un texto para preguntar, pero recibió un entero.');
  expect(run('var edad: entero = leer("Edad: ")').diagnostics[0].message).toContain('Para convertirlo usa `redondear(numero(...))`.');
});
