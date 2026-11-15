import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {describe, expect, test} from 'vitest';
import {compile, run, runCompiled, type ReadLine, type RunResult} from '../../src/index.js';

const examplesDirectory = 'ejemplos';
const fixedRandom = (): number => 0.5;
const smallStepLimit = 10_000;

// Fuente de entrada que entrega las líneas indicadas en orden
const linesReader = (lines: string[]): ReadLine => {
  const pending = [...lines];
  return () => pending.shift() ?? null;
};

// Ejecuta el programa en el intérprete y compilado, con la misma entrada, y devuelve ambos resultados
const runBoth = async (source: string, maxSteps?: number, input: string[] = []): Promise<[RunResult, RunResult]> => {
  const interpreted = run(source, {random: fixedRandom, maxSteps, read: linesReader(input)});
  const compiled = await runCompiled(source, {random: fixedRandom, maxSteps, read: linesReader(input)});
  return [interpreted, compiled];
};

// Lee la entrada de un ejemplo desde su archivo .entrada, si tiene
const exampleInput = (file: string): string[] => {
  const inputFile = `${examplesDirectory}/${file.replace(/\.kun$/, '.entrada')}`;
  if (!existsSync(inputFile)) {
    return [];
  }
  return readFileSync(inputFile, 'utf8').split('\n');
};

// Verifica que el programa compilado muestre lo mismo que el intérprete, sin errores
const expectSameOutput = async (source: string, input: string[] = []): Promise<string[]> => {
  const [interpreted, compiled] = await runBoth(source, undefined, input);
  expect(interpreted.diagnostics.map((diagnostic) => diagnostic.message)).toEqual([]);
  expect(compiled).toEqual(interpreted);
  return compiled.output;
};

// Verifica que el programa compilado falle con el mismo error de ejecución que el intérprete
const expectSameRuntimeError = async (source: string, maxSteps?: number): Promise<string> => {
  const [interpreted, compiled] = await runBoth(source, maxSteps);
  expect(interpreted.diagnostics).toHaveLength(1);
  expect(interpreted.diagnostics[0].stage).toBe('runtime');
  expect(compiled).toEqual(interpreted);
  return compiled.diagnostics[0].message;
};

// Devuelve el único error de compilación del programa
const compileErrorOf = (source: string): string => {
  const {diagnostics} = compile(source);
  expect(diagnostics).toHaveLength(1);
  expect(diagnostics[0].stage).toBe('compiler');
  return diagnostics[0].message;
};

describe('ejemplos', () => {
  const examples = readdirSync(examplesDirectory).filter((file) => file.endsWith('.kun') && file !== 'error.kun');

  // Cada ejemplo muestra lo mismo interpretado y compilado
  test.each(examples)('%s muestra lo mismo compilado', async (file) => {
    await expectSameOutput(readFileSync(`${examplesDirectory}/${file}`, 'utf8'), exampleInput(file));
  });

  // Cada ejemplo produce un binario válido y su texto
  test.each(examples)('%s produce un módulo válido', (file) => {
    const {binary, text} = compile(readFileSync(`${examplesDirectory}/${file}`, 'utf8'));
    expect(WebAssembly.validate(binary!)).toBe(true);
    expect(text).toMatch(/^\(module/);
  });
});

describe('equivalencia con el intérprete', () => {
  // Las operaciones aritméticas, incluido el residuo con negativos y decimales
  test('calcula igual las operaciones aritméticas', async () => {
    expect(await expectSameOutput('mostrar(1 + 2 * 3, 7 / 2, 7 % 3, -7 % 3, 5.5 % 2, -(4 - 10), 0.1 + 0.2)')).toEqual([
      '7 3.5 1 -1 1.5 6 0.30000000000000004',
    ]);
  });

  // Textos: unión con otros tipos, comparación y lectura por posición
  test('maneja los textos igual', async () => {
    const source = 'var t = "kuntur"\nmostrar("n: " + 5 + " " + verdadero + " " + [1, 2], t[0], longitud(t), "abeja" < "zorro", t == "kuntur", t != "otro")';
    expect(await expectSameOutput(source)).toEqual(['n: 5 verdadero [1, 2] k 6 verdadero verdadero verdadero']);
  });

  // Listas: crear, agregar, quitar, modificar, unir, anidar y comparar
  test('maneja las listas igual', async () => {
    const source = [
      'var l: lista de entero = [3, 1]',
      'agregar(l, 4)',
      'l[0] = 10',
      'var ultimo = quitar(l)',
      'var matriz: lista de lista de texto = [["a"], ["b", "c"]]',
      'mostrar(l, ultimo, longitud(l), l + [7], matriz, matriz[1][0], l == [10, 1], [1] != [2])',
    ].join('\n');
    expect(await expectSameOutput(source)).toEqual(['[10, 1] 4 2 [10, 1, 7] [["a"], ["b", "c"]] b verdadero verdadero']);
  });

  // Ciclos: pasos negativos y decimales, rangos al revés, romper y continuar anidados
  test('recorre los ciclos igual', async () => {
    const source = [
      'para i desde 6 hasta 0 paso -3 {',
      '  mostrar(i)',
      '}',
      'var vueltas = 0',
      'para x desde 0 hasta 1 paso 0.1 {',
      '  vueltas = vueltas + 1',
      '}',
      'para i desde 2 hasta 0 {',
      '  mostrar("nunca")',
      '}',
      'var n = 0',
      'mientras verdadero {',
      '  n = n + 1',
      '  si n % 2 == 0 {',
      '    continuar',
      '  }',
      '  para j desde 1 hasta 10 {',
      '    si j > 1 {',
      '      romper',
      '    }',
      '    mostrar(n, j)',
      '  }',
      '  si n > 4 {',
      '    romper',
      '  }',
      '}',
      'mostrar(vueltas)',
    ].join('\n');
    expect(await expectSameOutput(source)).toEqual(['6', '3', '0', '1 1', '3 1', '5 1', '11']);
  });

  // Funciones: recursión, variables globales y funciones sin retorno
  test('llama a las funciones igual', async () => {
    const source = [
      'var llamadas = 0',
      'funcion fib(n: entero): entero {',
      '  llamadas = llamadas + 1',
      '  si n < 2 {',
      '    retornar n',
      '  }',
      '  retornar fib(n - 1) + fib(n - 2)',
      '}',
      'funcion saludar(nombre: texto) {',
      '  si nombre == "" {',
      '    retornar',
      '  }',
      '  mostrar("Hola, " + nombre)',
      '}',
      'saludar("")',
      'saludar("Ana")',
      'mostrar(fib(15), llamadas)',
    ].join('\n');
    expect(await expectSameOutput(source)).toEqual(['Hola, Ana', '610 1973']);
  });

  // `y` y `o` no evalúan la derecha si no hace falta
  test('corta la evaluación de y / o igual', async () => {
    const source = 'funcion avisar(): logico {\n  mostrar("evaluada")\n  retornar verdadero\n}\nmostrar(falso y avisar(), verdadero o avisar(), verdadero y avisar())';
    expect(await expectSameOutput(source)).toEqual(['evaluada', 'falso verdadero verdadero']);
  });

  // Un texto vacío no se confunde con el texto que le sigue en la memoria
  test('distingue el texto vacío del texto siguiente', async () => {
    expect(await expectSameOutput('var vacio = ""\nvar nombre = "Ana"\nmostrar(vacio == "", nombre, longitud(vacio))')).toEqual(['verdadero Ana 0']);
  });

  // `leer` entrega las mismas líneas compiladas, y falla igual al acabarse la entrada
  test('lee la entrada igual', async () => {
    const source = 'var nombre = leer("Nombre: ")\nvar edad = numero(leer("Edad: "))\nmostrar(nombre, edad + 1, leer("") == "")';
    expect(await expectSameOutput(source, ['Ana', '20', ''])).toEqual(['Ana 21 verdadero']);
    const [interpreted, compiled] = await runBoth('var a = leer("a")\nvar b = leer("b")', undefined, ['1']);
    expect(compiled).toEqual(interpreted);
    expect(compiled.diagnostics[0].message).toContain('ya no hay más datos de entrada');
  });

  // Una función que muestra algo puede llamarse dentro de otro `mostrar`
  test('permite llamar a mostrar dentro de otro mostrar', async () => {
    const source = 'funcion doble(n: entero): entero {\n  mostrar("calculando", n)\n  retornar n * 2\n}\nmostrar("resultado:", doble(4))';
    expect(await expectSameOutput(source)).toEqual(['calculando 4', 'resultado: 8']);
  });

  // Funciones propias, ámbitos, asignación encadenada y comparación con nulo
  test('usa las funciones propias y los ámbitos igual', async () => {
    const source = [
      'var a = 1',
      'var b = 2',
      'a = b = 3',
      'var x = 1',
      '{',
      '  var x = 2',
      '  mostrar(x)',
      '}',
      'mostrar(a, b, x, tipo(1), tipo(2.5), tipo("t"), tipo(falso), tipo([1]))',
      'mostrar(redondear(2.5), redondear(-2.5), raiz(16), numero("4.5") + 1, texto(3) + "3", aleatorio(1, 10))',
      'mostrar(a == nulo, a != nulo, nulo == nulo)',
    ].join('\n');
    expect(await expectSameOutput(source)).toEqual([
      '2',
      '3 3 1 número número texto lógico lista',
      '3 -2 4 5.5 33 6',
      'falso verdadero verdadero',
    ]);
  });
});

describe('errores de ejecución', () => {
  // Cada error compilado tiene el mismo mensaje y la misma posición que en el intérprete
  test.each([
    ['división entre cero', 'var cero = 0\nmostrar(1 / cero)'],
    ['residuo entre cero', 'var cero = 0\nmostrar(1 % cero)'],
    ['posición fuera de la lista', 'var l = [1, 2, 3]\nmostrar(l[3])'],
    ['posición de un texto', 'var t = "hola"\nmostrar(t[10])'],
    ['quitar de una lista vacía', 'var l: lista de entero = []\nquitar(l)'],
    ['texto que no es número', 'mostrar(numero("abc"))'],
    ['raíz de un negativo', 'mostrar(raiz(-4))'],
    ['paso cero en una variable', 'var p = 0\npara i desde 1 hasta 3 paso p {\n}'],
    ['aleatorio al revés', 'mostrar(aleatorio(10, 1))'],
  ])('%s', async (_, source) => {
    await expectSameRuntimeError(source);
  });

  // Una función que usa una variable global antes de que se declare falla igual
  test('falla igual al leer o asignar una global antes de declararla', async () => {
    expect(await expectSameRuntimeError('funcion ver(): entero {\n  retornar total\n}\nmostrar(ver())\nvar total = 5')).toBe('`total` no existe.');
    expect(await expectSameRuntimeError('funcion poner() {\n  total = 1\n}\nponer()\nvar total = 5')).toContain('Para crearla escribe');
    expect(await expectSameOutput('var total = 5\nfuncion ver(): entero {\n  retornar total\n}\nmostrar(ver())')).toEqual(['5']);
  });

  // Los ciclos infinitos se cortan con el mismo límite de pasos
  test('corta los ciclos infinitos', async () => {
    expect(await expectSameRuntimeError('mientras verdadero {\n}', smallStepLimit)).toContain('¿Hay un ciclo que nunca termina?');
  });

  // La recursión infinita se corta con el mismo límite de llamadas
  test('corta la recursión infinita', async () => {
    const source = 'funcion f(n: entero): entero {\n  retornar f(n + 1)\n}\nmostrar(f(0))';
    expect(await expectSameRuntimeError(source)).toContain('demasiadas llamadas anidadas a `f`');
  });

  // Lo mostrado antes del error se conserva igual
  test('conserva lo mostrado antes del error', async () => {
    const [interpreted, compiled] = await runBoth('mostrar("antes")\nvar cero = 0\nmostrar(1 / cero)');
    expect(compiled).toEqual(interpreted);
    expect(compiled.output).toEqual(['antes']);
  });
});

describe('errores de compilación', () => {
  // Los parámetros necesitan tipo
  test('pide el tipo de los parámetros', () => {
    expect(compileErrorOf('funcion doble(n) {\n  mostrar(n)\n}')).toBe(
      'Para compilar a WebAssembly, el parámetro `n` de `doble` necesita su tipo, como `n: entero` o `n: lista de texto`.',
    );
  });

  // Una función que retorna un valor necesita su tipo de retorno
  test('pide el tipo de retorno', () => {
    expect(compileErrorOf('funcion uno() {\n  retornar 1\n}')).toContain('necesita su tipo de retorno');
  });

  // Las variables y listas sin tipo conocido
  test('pide el tipo de variables y listas', () => {
    expect(compileErrorOf('var x\nx = 1')).toContain('`x` necesita un tipo conocido');
    expect(compileErrorOf('var l = []')).toBe(
      'Para compilar a WebAssembly, `l` necesita el tipo de sus elementos, por ejemplo: `var l: lista de entero = []`.',
    );
  });

  // Funciones anidadas y funciones como valor
  test('rechaza funciones anidadas y funciones como valor', () => {
    expect(compileErrorOf('funcion afuera() {\n  funcion adentro() {\n  }\n}')).toContain('`adentro` está dentro de otra función');
    expect(compileErrorOf('funcion f() {\n}\nmostrar(f)')).toContain('usarla como valor');
  });

  // El resultado de una función sin retorno no se puede usar
  test('rechaza usar el resultado de una función sin retorno', () => {
    expect(compileErrorOf('funcion nada() {\n}\nmostrar(nada())')).toBe('La función `nada` no retorna ningún valor; no se puede usar su resultado.');
  });

  // Los errores de las etapas anteriores se informan primero
  test('informa primero los errores semánticos', () => {
    expect(compile('mostrar(noExiste)').diagnostics[0].stage).toBe('semantic');
  });
});

describe('texto del módulo', () => {
  // El texto usa los nombres del programa y solo importa las funciones del anfitrión que usa
  test('usa los nombres del programa', () => {
    const {text} = compile('funcion doble(n: entero): entero {\n  retornar n * 2\n}\nvar año = doble(21)\nmostrar(año)');
    expect(text).toContain('(func $doble (param $n f64) (result f64)');
    expect(text).toContain('(global $a_uf1_o (mut f64) (f64.const 0))');
    expect(text).toContain('call $doble');
    expect(text).not.toContain('list_new');
  });
});
