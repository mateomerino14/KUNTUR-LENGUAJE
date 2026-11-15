import {describe, expect, test} from 'vitest';
import {check, run} from '../src/index.js';

describe('etapas del análisis', () => {
  // Si hay errores léxicos no se ejecuta nada
  test('no ejecuta si hay errores léxicos', () => {
    const {output, diagnostics} = run('mostrar("hola")\nvar x = 1 && 2');
    expect(output).toEqual([]);
    expect(diagnostics[0].stage).toBe('lexer');
  });

  // Si hay errores de sintaxis no se ejecuta nada
  test('no ejecuta si hay errores de sintaxis', () => {
    const {output, diagnostics} = run('mostrar("hola")\nvar = 1');
    expect(output).toEqual([]);
    expect(diagnostics[0].stage).toBe('parser');
  });

  // Si hay errores semánticos no se ejecuta nada
  test('no ejecuta si hay errores semánticos', () => {
    const {output, diagnostics} = run('mostrar("hola")\nvar edad: entero = "veinte"');
    expect(output).toEqual([]);
    expect(diagnostics[0].stage).toBe('semantic');
  });

  // Los errores que dependen de los valores aparecen al ejecutar
  test('detecta al ejecutar los errores que dependen de los valores', () => {
    const {output, diagnostics} = run('mostrar("antes")\nvar lista = [1, 2]\nmostrar(lista[5])');
    expect(output).toEqual(['antes']);
    expect(diagnostics[0].stage).toBe('runtime');
  });

  // Un parámetro sin tipo se revisa recién al ejecutar
  test('revisa al ejecutar los valores de tipo desconocido', () => {
    const {diagnostics} = run('funcion menosUno(x) {\n  retornar x - 1\n}\nmostrar(menosUno("a"))');
    expect(diagnostics[0].stage).toBe('runtime');
    expect(diagnostics[0].message).toBe('No se puede restar un texto y un número; se necesitan dos números.');
  });

  // `check` revisa sin ejecutar
  test('revisa sin ejecutar con check', () => {
    expect(check('mostrar(1)').diagnostics).toEqual([]);
    expect(check('mostrar(noExiste)').diagnostics[0].stage).toBe('semantic');
  });
});
