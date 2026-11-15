import {describe, expect, test} from 'vitest';
import {EXERCISES} from '../../src/exercises/catalog.js';
import {firstDifference, gradeExercise} from '../../src/exercises/grader.js';

// Soluciones de referencia: prueban que cada ejercicio se puede resolver con lo que ofrece el lenguaje
const solutions: Record<string, string> = {
  'saludo': 'var nombre = leer("¿Cómo te llamas? ")\nmostrar("¡Hola, " + nombre + "!")',
  'par-impar': 'var n = redondear(numero(leer("Número: ")))\nsi n % 2 == 0 {\n  mostrar("par")\n}\nsino {\n  mostrar("impar")\n}',
  'suma': 'var n = redondear(numero(leer("N: ")))\nvar suma = 0\npara i desde 1 hasta n {\n  suma = suma + i\n}\nmostrar(suma)',
  'mayor': [
    'var a = numero(leer("Primero: "))',
    'var b = numero(leer("Segundo: "))',
    'var c = numero(leer("Tercero: "))',
    'var mayor = a',
    'si b > mayor {\n  mayor = b\n}',
    'si c > mayor {\n  mayor = c\n}',
    'mostrar(mayor)',
  ].join('\n'),
  'tabla': 'var n = redondear(numero(leer("Tabla del: ")))\npara i desde 1 hasta 10 {\n  mostrar(n, "x", i, "=", n * i)\n}',
  'pasaje': 'var adultos = numero(leer("Adultos: "))\nvar estudiantes = numero(leer("Estudiantes: "))\nmostrar("Total: Bs", adultos * 1.5 + estudiantes)',
  'vocales': [
    'funcion esVocal(letra: texto): logico {',
    '  var vocales = "aeiouAEIOU"',
    '  para i desde 0 hasta longitud(vocales) - 1 {',
    '    si vocales[i] == letra {',
    '      retornar verdadero',
    '    }',
    '  }',
    '  retornar falso',
    '}',
    'var frase = leer("Frase: ")',
    'var vocales = 0',
    'para i desde 0 hasta longitud(frase) - 1 {',
    '  si esVocal(frase[i]) {',
    '    vocales = vocales + 1',
    '  }',
    '}',
    'mostrar(vocales)',
  ].join('\n'),
  'aprobados': [
    'var cantidad = redondear(numero(leer("Cantidad: ")))',
    'var suma = 0.0',
    'var aprobados = 0',
    'para i desde 1 hasta cantidad {',
    '  var nota = numero(leer("Nota: "))',
    '  suma = suma + nota',
    '  si nota >= 51 {',
    '    aprobados = aprobados + 1',
    '  }',
    '}',
    'mostrar("Promedio:", redondear(suma / cantidad))',
    'mostrar("Aprobados:", aprobados)',
  ].join('\n'),
  'primo': [
    'var n = redondear(numero(leer("Número: ")))',
    'var esPrimo = verdadero',
    'para d desde 2 hasta n - 1 {',
    '  si n % d == 0 {',
    '    esPrimo = falso',
    '  }',
    '}',
    'si esPrimo {\n  mostrar("primo")\n}\nsino {\n  mostrar("no es primo")\n}',
  ].join('\n'),
  'invertir': 'var palabra = leer("Palabra: ")\nvar alReves = ""\npara i desde longitud(palabra) - 1 hasta 0 paso -1 {\n  alReves = alReves + palabra[i]\n}\nmostrar(alReves)',
  'fibonacci': [
    'var n = redondear(numero(leer("N: ")))',
    'var a = 0',
    'var b = 1',
    'var linea = "0"',
    'para i desde 2 hasta n {',
    '  linea = linea + " " + texto(b)',
    '  var siguiente = a + b',
    '  a = b',
    '  b = siguiente',
    '}',
    'mostrar(linea)',
  ].join('\n'),
};

describe('catálogo de ejercicios', () => {
  // Cada ejercicio tiene una solución de referencia que pasa todos sus casos
  test.each(EXERCISES.map((exercise) => [exercise.id, exercise] as const))('%s se puede resolver', (id, exercise) => {
    const result = gradeExercise(solutions[id], exercise);
    expect(result.blocking).toEqual([]);
    expect(result.results.filter((item) => item.outcome !== 'passed').map((item) => item.test.input)).toEqual([]);
    expect(result.solved).toBe(true);
  });

  // El código inicial no tiene errores, pero todavía no resuelve el ejercicio
  test.each(EXERCISES.map((exercise) => [exercise.id, exercise] as const))('%s empieza sin resolver', (_, exercise) => {
    const result = gradeExercise(exercise.starter, exercise);
    expect(result.blocking).toEqual([]);
    expect(result.solved).toBe(false);
  });

  // Cada ejercicio muestra al menos un caso como ejemplo y esconde al menos otro
  test('cada ejercicio tiene casos visibles y ocultos', () => {
    for (const exercise of EXERCISES) {
      expect(exercise.tests.some((item) => item.visible), exercise.id).toBe(true);
      expect(exercise.tests.some((item) => !item.visible), exercise.id).toBe(true);
    }
  });

  // Los identificadores no se repiten
  test('los identificadores son únicos', () => {
    expect(new Set(EXERCISES.map((exercise) => exercise.id)).size).toBe(EXERCISES.length);
  });
});

describe('corrección', () => {
  const greeting = EXERCISES.find((exercise) => exercise.id === 'saludo')!;

  // Un error antes de ejecutar no corre ningún caso
  test('no corre los casos si el programa tiene errores', () => {
    const result = gradeExercise('mostrar(nombre)', greeting);
    expect(result.blocking[0].message).toContain('`nombre` no existe');
    expect(result.results).toEqual([]);
  });

  // Una salida distinta se marca como incorrecta y se guarda lo que mostró
  test('marca la salida incorrecta', () => {
    const result = gradeExercise('var n = leer("")\nmostrar("Hola", n)', greeting);
    expect(result.results[0]).toMatchObject({outcome: 'wrong-output', actual: ['Hola Ana']});
    expect(result.solved).toBe(false);
  });

  // Un error al ejecutar se informa en su caso
  test('informa los errores de ejecución', () => {
    const result = gradeExercise('var a = leer("")\nvar b = leer("")\nmostrar(a)', greeting);
    expect(result.results[0].outcome).toBe('runtime-error');
    expect(result.results[0].diagnostics[0].message).toContain('ya no hay más datos de entrada');
  });

  // Los espacios al final de una línea no cuentan
  test('ignora los espacios al final de cada línea', () => {
    expect(gradeExercise('var n = leer("")\nmostrar("¡Hola, " + n + "!   ")', greeting).solved).toBe(true);
  });

  // Un ciclo infinito se corta y cuenta como error
  test('corta los ciclos infinitos', () => {
    const result = gradeExercise('mientras verdadero {\n}', greeting);
    expect(result.results[0].outcome).toBe('runtime-error');
  });

  // La primera diferencia señala la línea que hay que revisar
  test('encuentra la primera línea distinta', () => {
    expect(firstDifference(['a', 'b'], ['a', 'c'])).toBe(1);
    expect(firstDifference(['a', 'b'], ['a'])).toBe(1);
    expect(firstDifference(['a'], ['a'])).toBe(-1);
  });
});
