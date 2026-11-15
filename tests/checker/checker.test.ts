import {describe, expect, test} from 'vitest';
import {checkProgram} from '../../src/checker/checker.js';
import {parse} from '../../src/index.js';

// Revisa el programa y devuelve los mensajes del análisis semántico
const messagesOf = (source: string): string[] => {
  const {program, diagnostics} = parse(source);
  expect(diagnostics.map((diagnostic) => diagnostic.message)).toEqual([]);
  return checkProgram(program!).diagnostics.map((diagnostic) => diagnostic.message);
};

// Verifica que el programa no tenga errores semánticos
const expectValid = (source: string): void => {
  expect(messagesOf(source)).toEqual([]);
};

// Devuelve el único mensaje del análisis semántico
const onlyMessage = (source: string): string => {
  const messages = messagesOf(source);
  expect(messages).toHaveLength(1);
  return messages[0];
};

describe('nombres', () => {
  // Un nombre mal escrito se detecta antes de ejecutar y sugiere el correcto
  test('sugiere el nombre correcto antes de ejecutar', () => {
    expect(onlyMessage('var edad = 20\nmostrar(edda)')).toBe('`edda` no existe. ¿Quisiste decir `edad`?');
    expect(onlyMessage('mostar("hola")')).toBe('`mostar` no existe. ¿Quisiste decir `mostrar`?');
  });

  // Una variable dentro de una rama que nunca se ejecuta igual se revisa
  test('revisa también el código que no llegaría a ejecutarse', () => {
    expect(onlyMessage('si falso {\n  mostrar(nombreRaro)\n}')).toBe('`nombreRaro` no existe.');
  });

  // Las funciones pueden usar variables declaradas después en el mismo bloque
  test('permite que una función use variables declaradas más abajo', () => {
    expectValid('funcion verTotal() {\n  retornar total\n}\nvar total = 5\nmostrar(verTotal())');
  });

  // Las variables de un bloque no existen fuera de él
  test('respeta los ámbitos de los bloques', () => {
    expect(onlyMessage('si verdadero {\n  var dentro = 1\n}\nmostrar(dentro)')).toBe('`dentro` no existe.');
  });

  // Constantes, variables de ciclo y funciones no se reasignan
  test('impide reasignar lo que no es una variable común', () => {
    expect(onlyMessage('constante PI = 3.14\nPI = 3')).toBe('`PI` es una constante; su valor no se puede cambiar.');
    expect(onlyMessage('para i desde 1 hasta 3 {\n  i = 5\n}')).toContain('es la variable del ciclo `para`');
    expect(onlyMessage('funcion f() {\n}\nf = 2')).toBe('`f` es una función; no se le puede asignar un valor.');
  });

  // Declarar dos veces en el mismo bloque
  test('impide declarar dos veces el mismo nombre', () => {
    expect(onlyMessage('var x = 1\nvar x = 2')).toBe('Ya existe algo llamado `x` en este bloque; elige otro nombre.');
  });
});

describe('tipos de las variables', () => {
  // La variable toma el tipo de su valor inicial
  test('deduce el tipo del valor inicial', () => {
    expect(onlyMessage('var nombre = "Ana"\nnombre = 5')).toBe(
      '`nombre` es de tipo texto; no se le puede asignar un entero. Tomó ese tipo de su valor inicial. Para convertirlo usa `texto()`.',
    );
  });

  // El caso típico: empezar en 0 y luego guardar un decimal
  test('explica cómo guardar decimales en una variable que empezó en 0', () => {
    expect(onlyMessage('var promedio = 0\npromedio = 7 / 2')).toBe(
      '`promedio` es de tipo entero; no se le puede asignar un decimal. Tomó el tipo entero de su valor inicial; para guardar decimales, empieza con `0.0` o declárala con `: decimal`.',
    );
    expectValid('var promedio = 0.0\npromedio = 7 / 2');
  });

  // Un entero cabe donde se espera un decimal, pero no al revés
  test('acepta enteros en decimales y no al revés', () => {
    expectValid('var precio: decimal = 10');
    expect(onlyMessage('var cantidad: entero = 2.5')).toContain('Para quitar los decimales usa `redondear()`.');
  });

  // Las variables sin valor inicial ni tipo aceptan cualquier valor
  test('acepta cualquier valor en variables sin tipo ni valor inicial', () => {
    expectValid('var x\nx = 1\nx = "uno"');
  });

  // Una variable con tipo necesita valor inicial
  test('exige valor inicial en una variable con tipo', () => {
    expect(onlyMessage('var total: decimal')).toBe(
      'La variable `total` es de tipo decimal y necesita un valor inicial, por ejemplo: `var total: decimal = 0.0`.',
    );
  });

  // Un tipo mal escrito sugiere el correcto
  test('sugiere el tipo correcto', () => {
    expect(onlyMessage('var nombre: texot = "Ana"')).toContain('¿Quisiste decir `texto`?');
  });

  // `lógico` con tilde también es un tipo válido
  test('acepta logico con y sin tilde', () => {
    expectValid('var a: logico = verdadero\nvar b: lógico = falso');
  });
});

describe('listas', () => {
  // Los elementos de una lista con tipo deben coincidir
  test('revisa los elementos de una lista con tipo', () => {
    expect(onlyMessage('var notas: lista de entero = [70, "ochenta"]')).toBe('Esta lista es de entero; no se le puede guardar un texto.');
    expect(onlyMessage('var matriz: lista de lista de entero = [[1], [2.5]]')).toBe('Esta lista es de entero; no se le puede guardar un decimal.');
    expect(onlyMessage('var notas = [70, 85]\nagregar(notas, "cien")')).toBe('Esta lista es de entero; no se le puede agregar un texto.');
    expect(onlyMessage('var notas = [70, 85]\nnotas[0] = 9.5')).toBe('Esta lista es de entero; no se le puede guardar un decimal.');
  });

  // Una lista vacía se puede llenar con cualquier tipo
  test('acepta una lista vacía en cualquier lista con tipo', () => {
    expectValid('var nombres: lista de texto = []\nagregar(nombres, "Ana")');
  });

  // Mezclar enteros y decimales da una lista de decimal
  test('deduce lista de decimal al mezclar enteros y decimales', () => {
    expectValid('var precios = [1, 2.5]\nagregar(precios, 3.75)');
  });

  // Leer una posición devuelve el tipo de los elementos
  test('deduce el tipo de un elemento leído', () => {
    expect(onlyMessage('var notas = [70, 85]\nvar primera: texto = notas[0]')).toContain('no se le puede asignar un entero');
  });

  // La posición debe ser entera
  test('exige posiciones enteras', () => {
    expect(onlyMessage('var l = [1, 2]\nmostrar(l[0.5])')).toBe('La posición debe ser un entero, pero aquí es un decimal.');
  });

  // Los textos no se modifican por posición
  test('impide modificar un texto por posición', () => {
    expect(onlyMessage('var t = "hola"\nt[0] = "H"')).toBe('Los textos no se pueden modificar por posición; arma un texto nuevo.');
  });
});

describe('operaciones', () => {
  // Operaciones entre tipos incompatibles
  test('explica las operaciones entre tipos incompatibles', () => {
    expect(onlyMessage('mostrar("a" - 1)')).toBe('No se puede restar un texto y un entero; se necesitan dos números.');
    expect(onlyMessage('mostrar([1] + 2)')).toBe('No se puede sumar una lista de entero y un entero.');
    expect(onlyMessage('mostrar(1 < "2")')).toContain('solo se comparan dos números o dos textos');
  });

  // Comparar tipos que nunca son iguales
  test('avisa al comparar tipos que nunca son iguales', () => {
    expect(onlyMessage('mostrar("5" == 5)')).toBe('Comparar un texto con un entero siempre da falso. ¿Falta convertir con `numero()` o `texto()`?');
    expectValid('mostrar(1 == 1.0, nulo == 1)');
  });

  // Las condiciones y los operadores lógicos solo aceptan verdadero o falso
  test('exige condiciones lógicas', () => {
    expect(onlyMessage('var edad = 20\nsi edad {\n}')).toBe('La condición del `si` debe ser verdadero o falso, pero es un entero.');
    expect(onlyMessage('mostrar(1 y verdadero)')).toBe('`y` une condiciones verdaderas o falsas, pero a la izquierda hay un entero.');
  });

  // Dividir siempre da decimal
  test('deduce decimal al dividir', () => {
    expect(onlyMessage('var mitad: entero = 10 / 2')).toContain('no se le puede asignar un decimal');
  });

  // El `paso` cero se detecta antes de ejecutar
  test('impide un paso cero escrito directamente', () => {
    expect(onlyMessage('para i desde 1 hasta 3 paso 0 {\n}')).toBe('El `paso` no puede ser cero: el ciclo nunca terminaría.');
  });
});

describe('funciones', () => {
  // Los argumentos deben coincidir con los tipos de los parámetros
  test('revisa los tipos de los argumentos', () => {
    expect(onlyMessage('funcion suma(a: entero, b: entero): entero {\n  retornar a + b\n}\nsuma(1, "2")')).toBe(
      'El parámetro `b` de `suma` espera un entero, pero recibió un texto.',
    );
  });

  // La cantidad de argumentos se revisa antes de ejecutar
  test('revisa la cantidad de argumentos', () => {
    expect(onlyMessage('funcion f(a, b) {\n}\nf(1)')).toBe('La función `f` espera 2 valores, pero recibió 1 valor.');
    expect(onlyMessage('longitud([1], [2])')).toBe('La función `longitud` espera 1 valor, pero recibió 2 valores.');
  });

  // El valor retornado debe coincidir con el tipo de retorno
  test('revisa el tipo del valor retornado', () => {
    expect(onlyMessage('funcion mitad(n: entero): entero {\n  retornar n / 2\n}')).toBe(
      'La función `mitad` debe retornar un entero, pero aquí retorna un decimal. Para quitar los decimales usa `redondear()`.',
    );
    expect(onlyMessage('funcion f(): texto {\n  retornar\n}')).toBe('La función `f` debe retornar un texto; falta el valor después de `retornar`.');
  });

  // Una función con tipo de retorno debe retornar en todos los caminos
  test('exige retornar en todos los caminos', () => {
    expect(onlyMessage('funcion signo(n: entero): texto {\n  si n > 0 {\n    retornar "positivo"\n  }\n}')).toBe(
      'La función `signo` debe retornar un texto, pero puede terminar sin llegar a `retornar`. Revisa que cada camino, incluido el `sino`, retorne un valor.',
    );
    expectValid('funcion signo(n: entero): texto {\n  si n > 0 {\n    retornar "positivo"\n  }\n  sino si n < 0 {\n    retornar "negativo"\n  }\n  sino {\n    retornar "cero"\n  }\n}');
    expectValid('funcion primero(l: lista de entero): entero {\n  mientras verdadero {\n    retornar l[0]\n  }\n}');
    expect(messagesOf('funcion f(): entero {\n  mientras verdadero {\n    si verdadero {\n      romper\n    }\n  }\n}')).toHaveLength(1);
  });

  // Las funciones sin tipo de retorno pueden terminar sin retornar
  test('no exige retornar en funciones sin tipo de retorno', () => {
    expectValid('funcion saludar(nombre) {\n  si nombre == "" {\n    retornar\n  }\n  mostrar("Hola", nombre)\n}');
  });

  // El resultado de una función con tipo de retorno se usa con ese tipo
  test('usa el tipo de retorno en quien llama', () => {
    expect(onlyMessage('funcion nombre(): texto {\n  retornar "Ana"\n}\nvar n: entero = nombre()')).toContain(
      'no se le puede asignar un texto',
    );
  });

  // Llamar a algo que no es función
  test('impide llamar a algo que no es una función', () => {
    expect(onlyMessage('var x = 5\nx()')).toBe('`x` no es una función, es un entero.');
  });

  // Las funciones propias revisan sus argumentos
  test('revisa los argumentos de las funciones propias', () => {
    expect(onlyMessage('mostrar(longitud(5))')).toBe('`longitud` necesita una lista o un texto, pero recibió un entero.');
    expect(onlyMessage('mostrar(aleatorio(1, 2.5))')).toBe('`aleatorio` necesita un entero, pero recibió un decimal.');
  });

  // Los parámetros sin tipo aceptan cualquier valor y no se revisan
  test('no revisa los parámetros sin tipo', () => {
    expectValid('funcion doble(x) {\n  retornar x * 2\n}\nmostrar(doble(2), doble("a"))');
  });
});

describe('orden de los errores', () => {
  // Los errores salen ordenados por línea aunque estén dentro de funciones
  test('ordena los errores por línea', () => {
    const {program} = parse('funcion f() {\n  retornar a\n}\nmostrar(b)');
    const lines = checkProgram(program!).diagnostics.map((diagnostic) => diagnostic.position.line);
    expect(lines).toEqual([2, 4]);
  });
});
