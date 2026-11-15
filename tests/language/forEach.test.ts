import {describe, expect, test} from 'vitest';
import {expectSameEverywhere, messagesOf} from './helpers.js';

describe('para cada', () => {
  // Recorre los elementos de una lista y los caracteres de un texto
  test('recorre listas y textos', async () => {
    const source = 'var notas = [70, 85, 40]\nvar suma = 0\npara cada nota en notas {\n  suma = suma + nota\n}\nmostrar(suma)\npara cada letra en "año" {\n  mostrar(letra)\n}';
    expect(await expectSameEverywhere(source)).toEqual(['195', 'a', 'ñ', 'o']);
  });

  // `romper` y `continuar` funcionan como en los otros ciclos
  test('admite romper y continuar', async () => {
    const source = 'para cada x en [1, 2, 3, 4, 5] {\n  si x == 2 {\n    continuar\n  }\n  si x == 4 {\n    romper\n  }\n  mostrar(x)\n}';
    expect(await expectSameEverywhere(source)).toEqual(['1', '3']);
  });

  // Recorre hasta el largo inicial: lo que se agrega durante el ciclo no se recorre
  test('recorre hasta el largo que tenía la lista al empezar', async () => {
    const source = 'var l: lista de entero = [1, 2]\npara cada x en l {\n  agregar(l, x * 10)\n}\nmostrar(l)';
    expect(await expectSameEverywhere(source)).toEqual(['[1, 2, 10, 20]']);
  });

  // Si la lista se acorta durante el ciclo, el ciclo termina antes
  test('termina antes si la lista se acorta', async () => {
    const source = 'var l: lista de entero = [1, 2, 3, 4]\npara cada x en l {\n  mostrar(x)\n  quitar(l)\n}';
    expect(await expectSameEverywhere(source)).toEqual(['1', '2']);
  });

  // La variable toma el tipo de los elementos y no se puede cambiar
  test('da a la variable el tipo de los elementos', () => {
    expect(messagesOf('para cada nota en [1, 2] {\n  var t: texto = nota\n}')[0]).toContain('no se le puede asignar un entero');
    expect(messagesOf('para cada nota en [1, 2] {\n  nota = 3\n}')[0]).toContain('es la variable del ciclo');
  });

  // Solo recorre listas, textos o diccionarios
  test('informa lo que no se puede recorrer', () => {
    expect(messagesOf('para cada x en 5 {\n}')[0]).toBe('`para cada` recorre listas, textos o diccionarios, pero aquí hay un entero.');
  });

  // Una forma mal escrita explica cómo es
  test('explica la forma correcta', () => {
    expect(messagesOf('para cada nota de notas {\n}')[0]).toBe('Para recorrer una lista escribe `para cada nota en lista { }`.');
  });

  // `cada` y `en` siguen siendo nombres válidos fuera de este lugar
  test('permite usar cada y en como nombres', async () => {
    expect(await expectSameEverywhere('var en = 2\nvar cada = 3\npara cada desde en hasta cada {\n  mostrar(cada)\n}')).toEqual(['2', '3']);
  });
});
