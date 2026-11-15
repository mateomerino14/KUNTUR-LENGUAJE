import {describe, expect, test} from 'vitest';
import {expectSameEverywhere, messagesOf} from './helpers.js';

const student = 'registro Alumno {\n  nombre: texto\n  nota: entero\n}\n';

describe('registros', () => {
  // Se crean con su nombre, se leen y cambian sus campos, y se muestran con sus campos
  test('crea registros y usa sus campos', async () => {
    const source = `${student}var a = Alumno("Ana", 85)\na.nota = a.nota + 5\nmostrar(a.nombre, a.nota)\nmostrar(a, tipo(a))`;
    expect(await expectSameEverywhere(source)).toEqual(['Ana 90', 'Alumno(nombre: "Ana", nota: 90) Alumno']);
  });

  // Funcionan en listas, como parámetros y como resultado de funciones
  test('se usan en listas y funciones', async () => {
    const source = `${student}funcion mejor(curso: lista de Alumno): Alumno {
  var elegido = curso[0]
  para cada alumno en curso {
    si alumno.nota > elegido.nota {
      elegido = alumno
    }
  }
  retornar elegido
}
var curso: lista de Alumno = [Alumno("Ana", 70), Alumno("Luis", 95), Alumno("Eva", 80)]
curso[0].nota = 99
mostrar(mejor(curso).nombre)`;
    expect(await expectSameEverywhere(source)).toEqual(['Ana']);
  });

  // Un registro puede tener otro registro como campo, aunque se declare después
  test('anida registros', async () => {
    const source = 'registro Punto { x: decimal, y_: decimal }\nregistro Linea {\n  inicio: Punto\n  fin: Punto\n}\nvar l = Linea(Punto(0, 0), Punto(3, 4))\nl.fin.x = 6\nmostrar(l)\nmostrar(l.inicio == Punto(0, 0), l.inicio == l.fin)';
    expect(await expectSameEverywhere(source)).toEqual([
      'Linea(inicio: Punto(x: 0, y_: 0), fin: Punto(x: 6, y_: 4))',
      'verdadero falso',
    ]);
  });

  // Los campos tienen tipo y el nombre de un campo inexistente se sugiere
  test('revisa campos y tipos', () => {
    expect(messagesOf(`${student}var a = Alumno("Ana", 85)\nmostrar(a.notas)`)[0]).toBe('`Alumno` no tiene el campo `notas`. ¿Quisiste decir `nota`?');
    expect(messagesOf(`${student}var a = Alumno("Ana", 85)\na.nota = "alta"`)[0]).toBe('El campo `nota` es de tipo entero; no se le puede asignar un texto.');
    expect(messagesOf(`${student}var a = Alumno("Ana")`)[0]).toContain('`Alumno`');
    expect(messagesOf(`${student}var a = Alumno(85, "Ana")`)[0]).toBe('El parámetro `nombre` de `Alumno` espera un texto, pero recibió un entero.');
    expect(messagesOf('var x = 5\nmostrar(x.valor)')[0]).toBe('Solo los registros tienen campos, pero aquí hay un entero.');
  });

  // Se declaran solo en el programa principal y con un nombre que no sea de tipo
  test('se declaran fuera de funciones y bloques', () => {
    expect(messagesOf('si verdadero {\n  registro P { x: entero }\n}')[0]).toBe('Los registros se declaran en el programa principal, fuera de funciones y bloques.');
    expect(messagesOf('registro texto { x: entero }')[0]).toBe('`texto` ya es el nombre de un tipo; elige otro nombre para el registro.');
    expect(messagesOf('registro P { x: entero, x: texto }')[0]).toBe('El campo `x` está repetido en `P`.');
  });

  // `registro` sigue siendo un nombre válido para una variable
  test('permite usar registro como nombre', async () => {
    expect(await expectSameEverywhere('var registro = 3\nmostrar(registro)')).toEqual(['3']);
  });
});
