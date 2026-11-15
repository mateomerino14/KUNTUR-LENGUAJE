import {describe, expect, test} from 'vitest';
import {parse, type RunResult} from '../../src/index.js';
import {interpret} from '../../src/interpreter/interpreter.js';

// Ejecuta el programa sin el análisis semántico, para probar al intérprete por sí solo
const execute = (source: string, maxSteps?: number, random?: () => number): RunResult => {
  const {program, diagnostics} = parse(source);
  if (program === null) {
    return {output: [], diagnostics};
  }
  const output: string[] = [];
  const result = interpret(program, {write: (line) => output.push(line), maxSteps, random});
  return {output, diagnostics: result.diagnostics};
};

// Ejecuta el programa y devuelve lo mostrado, fallando si hubo errores
const outputOf = (source: string): string[] => {
  const {output, diagnostics} = execute(source);
  expect(diagnostics.map((diagnostic) => diagnostic.message)).toEqual([]);
  return output;
};

// Ejecuta el programa y devuelve el único error de ejecución
const runtimeErrorOf = (source: string): string => {
  const {diagnostics} = execute(source, 10_000);
  expect(diagnostics).toHaveLength(1);
  expect(diagnostics[0].stage).toBe('runtime');
  return diagnostics[0].message;
};

describe('valores y operaciones', () => {
  // Las operaciones aritméticas respetan la precedencia
  test('calcula expresiones aritméticas', () => {
    expect(outputOf('mostrar(1 + 2 * 3, (1 + 2) * 3, 7 / 2, 7 % 3, -4 + 1)')).toEqual(['7 9 3.5 1 -3']);
  });

  // Sumar un texto con cualquier valor los une como texto
  test('une textos con otros valores', () => {
    expect(outputOf('mostrar("Edad: " + 20 + ", activo: " + verdadero)')).toEqual(['Edad: 20, activo: verdadero']);
  });

  // Los valores se muestran en español
  test('muestra los valores en español', () => {
    expect(outputOf('mostrar(verdadero, falso, nulo, [1, "a", [2]])')).toEqual(['verdadero falso nulo [1, "a", [2]]']);
  });

  // Las listas se comparan por su contenido
  test('compara listas por su contenido', () => {
    expect(outputOf('mostrar([1, 2] == [1, 2], [1] != [2], 1 == "1")')).toEqual(['verdadero verdadero falso']);
  });

  // `y` no evalúa la derecha si la izquierda es falsa
  test('corta la evaluación de y / o', () => {
    expect(outputOf('mostrar(falso y noExiste(), verdadero o noExiste())')).toEqual(['falso verdadero']);
  });

  // Los textos se comparan en orden alfabético
  test('compara textos', () => {
    expect(outputOf('mostrar("abeja" < "zorro")')).toEqual(['verdadero']);
  });
});

describe('variables y ámbitos', () => {
  // Una variable declarada sin valor empieza en nulo
  test('inicia en nulo las variables sin valor', () => {
    expect(outputOf('var x\nmostrar(x)')).toEqual(['nulo']);
  });

  // Un bloque puede tapar una variable de afuera sin cambiarla
  test('respeta los ámbitos de los bloques', () => {
    expect(outputOf('var x = 1\n{\n  var x = 2\n  mostrar(x)\n}\nmostrar(x)')).toEqual(['2', '1']);
  });

  // Un nombre de función propia se puede usar como variable
  test('permite usar texto o numero como nombre de variable', () => {
    expect(outputOf('var texto = "hola"\nmostrar(texto)')).toEqual(['hola']);
  });
});

describe('control de flujo', () => {
  // `si`, `sino si` y `sino` eligen una sola rama
  test('elige la rama correcta del si', () => {
    const source = 'funcion signo(n) {\n  si n > 0 {\n    retornar "positivo"\n  }\n  sino si n < 0 {\n    retornar "negativo"\n  }\n  sino {\n    retornar "cero"\n  }\n}\nmostrar(signo(5), signo(-2), signo(0))';
    expect(outputOf(source)).toEqual(['positivo negativo cero']);
  });

  // `mientras` repite y `romper` / `continuar` controlan el ciclo
  test('repite con mientras, romper y continuar', () => {
    const source = 'var i = 0\nmientras verdadero {\n  i = i + 1\n  si i % 2 == 0 {\n    continuar\n  }\n  si i > 7 {\n    romper\n  }\n  mostrar(i)\n}';
    expect(outputOf(source)).toEqual(['1', '3', '5', '7']);
  });

  // `para` incluye ambos límites
  test('recorre el rango del para incluyendo los límites', () => {
    expect(outputOf('para i desde 1 hasta 3 {\n  mostrar(i)\n}')).toEqual(['1', '2', '3']);
  });

  // `para` con paso negativo cuenta hacia abajo
  test('cuenta hacia abajo con paso negativo', () => {
    expect(outputOf('para i desde 6 hasta 0 paso -3 {\n  mostrar(i)\n}')).toEqual(['6', '3', '0']);
  });

  // Sin paso, un rango al revés no hace ninguna vuelta
  test('no recorre un rango al revés sin paso negativo', () => {
    expect(outputOf('para i desde 2 hasta 0 {\n  mostrar(i)\n}\nmostrar("fin")')).toEqual(['fin']);
  });

  // `para` con decimales no acumula errores de redondeo
  test('recorre pasos decimales sin perder la última vuelta', () => {
    expect(outputOf('var vueltas = 0\npara x desde 0 hasta 1 paso 0.1 {\n  vueltas = vueltas + 1\n}\nmostrar(vueltas)')).toEqual(['11']);
  });
});

describe('funciones', () => {
  // Las funciones se pueden llamar antes de su declaración
  test('permite llamar funciones declaradas más abajo', () => {
    expect(outputOf('mostrar(doble(4))\nfuncion doble(n) {\n  retornar n * 2\n}')).toEqual(['8']);
  });

  // La recursión funciona
  test('ejecuta funciones recursivas', () => {
    const source = 'funcion fib(n) {\n  si n < 2 {\n    retornar n\n  }\n  retornar fib(n - 1) + fib(n - 2)\n}\nmostrar(fib(15))';
    expect(outputOf(source)).toEqual(['610']);
  });

  // Las funciones recuerdan el ámbito donde se declararon
  test('captura las variables del ámbito donde se declaró', () => {
    const source = 'funcion contador() {\n  var cuenta = 0\n  funcion siguiente() {\n    cuenta = cuenta + 1\n    retornar cuenta\n  }\n  retornar siguiente\n}\nvar c = contador()\nc()\nmostrar(c())';
    expect(outputOf(source)).toEqual(['2']);
  });

  // Una función sin `retornar` devuelve nulo
  test('devuelve nulo si no retorna nada', () => {
    expect(outputOf('funcion nada() {\n}\nmostrar(nada())')).toEqual(['nulo']);
  });
});

describe('listas y funciones propias', () => {
  // Las listas se leen y modifican por posición
  test('lee y modifica listas por posición', () => {
    expect(outputOf('var l = [1, 2, 3]\nl[0] = 10\nagregar(l, 4)\nmostrar(l, longitud(l))\nmostrar(quitar(l), l)')).toEqual([
      '[10, 2, 3, 4] 4',
      '4 [10, 2, 3]',
    ]);
  });

  // Los textos se leen por posición
  test('lee los caracteres de un texto', () => {
    expect(outputOf('var t = "kuntur"\nmostrar(t[0], longitud(t))')).toEqual(['k 6']);
  });

  // Conversión entre tipos
  test('convierte entre textos y números', () => {
    expect(outputOf('mostrar(numero("42") + 1, texto(3) + "3", tipo(1), tipo("a"), tipo([]), tipo(nulo))')).toEqual([
      '43 33 número texto lista nulo',
    ]);
  });

  // `aleatorio` usa la fuente de azar indicada y respeta los límites
  test('genera números al azar dentro de los límites', () => {
    const {output} = execute('mostrar(aleatorio(1, 6), aleatorio(1, 6))', undefined, () => 0.999);
    expect(output).toEqual(['6 6']);
  });

  // Una lista que se contiene a sí misma no rompe `mostrar`
  test('muestra una lista que se contiene a sí misma', () => {
    expect(outputOf('var l = [1]\nagregar(l, l)\nmostrar(l)')).toEqual(['[1, [...]]']);
  });
});

describe('errores de ejecución', () => {
  // Una variable mal escrita sugiere la correcta
  test('sugiere el nombre correcto de una variable', () => {
    expect(runtimeErrorOf('var edad = 20\nmostrar(edda)')).toBe('`edda` no existe. ¿Quisiste decir `edad`?');
  });

  // Una función propia mal escrita sugiere la correcta
  test('sugiere el nombre correcto de una función propia', () => {
    expect(runtimeErrorOf('mostar("hola")')).toBe('`mostar` no existe. ¿Quisiste decir `mostrar`?');
  });

  // Asignar a una variable no declarada explica cómo declararla
  test('explica cómo declarar una variable al asignarla', () => {
    expect(runtimeErrorOf('total = 5')).toBe('`total` no existe. Para crearla escribe `var total = ...`.');
  });

  // Las constantes y la variable del ciclo no se pueden cambiar
  test('impide cambiar constantes y la variable del ciclo', () => {
    expect(runtimeErrorOf('constante PI = 3.14\nPI = 3')).toBe('`PI` es una constante; su valor no se puede cambiar.');
    expect(runtimeErrorOf('para i desde 1 hasta 3 {\n  i = 5\n}')).toContain('es la variable del ciclo `para`');
  });

  // Declarar dos veces en el mismo bloque
  test('impide declarar dos veces el mismo nombre', () => {
    expect(runtimeErrorOf('var x = 1\nvar x = 2')).toBe('Ya existe algo llamado `x` en este bloque; elige otro nombre.');
  });

  // Operaciones entre tipos incompatibles
  test('explica las operaciones entre tipos incompatibles', () => {
    expect(runtimeErrorOf('mostrar("a" - 1)')).toBe('No se puede restar un texto y un número; se necesitan dos números.');
    expect(runtimeErrorOf('mostrar([1] + 2)')).toBe('No se puede sumar una lista y un número.');
    expect(runtimeErrorOf('mostrar(1 < "2")')).toContain('solo se comparan dos números o dos textos');
  });

  // Dividir entre cero
  test('impide dividir entre cero', () => {
    expect(runtimeErrorOf('mostrar(1 / 0)')).toBe('No se puede dividir entre cero.');
    expect(runtimeErrorOf('mostrar(1 % 0)')).toBe('No se puede dividir entre cero.');
  });

  // Las condiciones deben ser verdadero o falso
  test('exige condiciones lógicas', () => {
    expect(runtimeErrorOf('si 1 {\n}')).toBe('La condición del `si` debe ser verdadero o falso, pero es un número.');
    expect(runtimeErrorOf('mostrar(1 y verdadero)')).toBe('`y` une condiciones verdaderas o falsas, pero a la izquierda hay un número.');
  });

  // Llamar a algo que no es función o con argumentos de más
  test('explica llamadas incorrectas', () => {
    expect(runtimeErrorOf('var x = 5\nx()')).toBe('`x` no es una función, es un número.');
    expect(runtimeErrorOf('funcion f(a, b) {\n}\nf(1)')).toBe('La función `f` espera 2 valores, pero recibió 1 valor.');
  });

  // Posiciones fuera de la lista
  test('explica las posiciones fuera de rango', () => {
    expect(runtimeErrorOf('var l = [1, 2, 3]\nmostrar(l[3])')).toBe('La posición 3 no existe: hay 3 elementos, en las posiciones 0 a 2.');
    expect(runtimeErrorOf('mostrar([][0])')).toBe('La posición 0 no existe: no hay ningún elemento.');
    expect(runtimeErrorOf('mostrar([1][0.5])')).toBe('La posición debe ser un número entero, pero aquí es un número (0.5).');
  });

  // La recursión sin fin se detiene con un mensaje claro
  test('detiene la recursión infinita', () => {
    expect(runtimeErrorOf('funcion f() {\n  retornar f()\n}\nf()')).toContain('demasiadas llamadas anidadas a `f`');
  });

  // Un ciclo infinito se detiene al superar el límite de pasos
  test('detiene los ciclos infinitos', () => {
    expect(runtimeErrorOf('mientras verdadero {\n}')).toContain('¿Hay un ciclo que nunca termina?');
  });

  // El error indica la posición exacta
  test('indica la línea y la columna del error', () => {
    const {diagnostics} = execute('var a = 1\nvar b = a + c');
    expect(diagnostics[0].position).toEqual({line: 2, column: 13});
  });

  // Lo mostrado antes del error se conserva
  test('conserva lo mostrado antes del error', () => {
    const {output} = execute('mostrar("antes")\nmostrar(1 / 0)\nmostrar("después")');
    expect(output).toEqual(['antes']);
  });
});
