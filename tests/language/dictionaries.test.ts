import {describe, expect, test} from 'vitest';
import {expectSameEverywhere, messagesOf} from './helpers.js';

describe('diccionarios', () => {
  // Guarda, actualiza y muestra los valores en el orden en que se agregaron
  test('guarda y actualiza claves', async () => {
    const source = 'var edades = {"Ana": 20, "Luis": 18}\nedades["Eva"] = 22\nedades["Ana"] = 21\nmostrar(edades, longitud(edades))\nmostrar(edades["Ana"] + 1)';
    expect(await expectSameEverywhere(source)).toEqual(['{"Ana": 21, "Luis": 18, "Eva": 22} 3', '22']);
  });

  // `tiene` revisa una clave y `claves` devuelve la lista de claves
  test('consulta claves con tiene y claves', async () => {
    const source = 'var d = {"a": verdadero}\nmostrar(tiene(d, "a"), tiene(d, "b"))\nmostrar(claves(d))';
    expect(await expectSameEverywhere(source)).toEqual(['verdadero falso', '["a"]']);
  });

  // `para cada` recorre las claves
  test('se recorre con para cada', async () => {
    const source = 'var precios = {"pan": 0.5, "leche": 6}\nvar total = 0.0\npara cada producto en precios {\n  mostrar(producto)\n  total = total + precios[producto]\n}\nmostrar(total)';
    expect(await expectSameEverywhere(source)).toEqual(['pan', 'leche', '6.5']);
  });

  // Un diccionario vacío necesita su tipo, y se compara clave por clave
  test('compara diccionarios sin importar el orden', async () => {
    const source = 'var d: diccionario de lista de entero = {}\nd["x"] = [1]\nmostrar(d, d == {"x": [1]}, {"a": 1, "b": 2} == {"b": 2, "a": 1}, d == {"y": [1]})';
    expect(await expectSameEverywhere(source)).toEqual(['{"x": [1]} verdadero verdadero falso']);
  });

  // Leer una clave que no existe es un error que sugiere `tiene`
  test('informa la clave que falta', async () => {
    await expectSameEverywhere('var d = {"a": 1}\nmostrar(d["b"])');
    expect(messagesOf('var d = {"a": 1}\nmostrar(d["b"])')).toEqual([
      'El diccionario no tiene la clave "b". Usa `tiene(diccionario, clave)` para revisar antes de leerla.',
    ]);
  });

  // Las claves son textos y los valores respetan el tipo del diccionario
  test('revisa los tipos de claves y valores', () => {
    expect(messagesOf('var d = {1: "a"}')[0]).toBe('Las claves de un diccionario son textos, pero aquí hay un entero.');
    expect(messagesOf('var d = {"a": 1}\nd["b"] = "x"')[0]).toBe('Este diccionario es de entero; no se le puede guardar un texto.');
    expect(messagesOf('var d: diccionario de texto = {"a": 1}')[0]).toBe('Este diccionario es de texto; no se le puede guardar un entero.');
    expect(messagesOf('var d = {"a": 1}\nvar t: texto = d["a"]')[0]).toContain('no se le puede asignar un entero');
  });

  // Un diccionario puede escribirse en varias líneas
  test('admite varias líneas', async () => {
    expect(await expectSameEverywhere('var d = {\n  "uno": 1,\n  "dos": 2,\n}\nmostrar(d)')).toEqual(['{"uno": 1, "dos": 2}']);
  });
});
