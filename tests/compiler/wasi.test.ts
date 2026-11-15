import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {describe, expect, test} from 'vitest';
import {compileProgram} from '../../src/compiler/codegen.js';
import {hostSignatures} from '../../src/compiler/host.js';
import {runtimeFunctions, WASI_MODULE} from '../../src/compiler/wasi/runtime.js';
import {runWasiModule, type WasiRunResult} from '../../src/compiler/wasi/nodeRunner.js';
import {encodeModule} from '../../src/compiler/wasm/module.js';
import {check, compile, formatDiagnostic, run} from '../../src/index.js';

const examplesDirectory = 'ejemplos';

interface Expected {
  stdout: string;
  stderr: string;
  exitCode: number;
}

// Separa la entrada en líneas; un texto vacío no tiene ninguna
const inputLines = (input: string): string[] => {
  if (input === '') {
    return [];
  }
  return input.split('\n');
};

// Lee la entrada de un ejemplo desde su archivo .entrada, si tiene
const exampleInput = (file: string): string => {
  const inputFile = `${examplesDirectory}/${file.replace(/\.kun$/, '.entrada')}`;
  if (!existsSync(inputFile)) {
    return '';
  }
  return readFileSync(inputFile, 'utf8');
};

// Lo que mostraría la terminal con el intérprete: salida, preguntas de `leer` con su respuesta repetida, y el error
const interpretAsTerminal = (source: string, input: string): Expected => {
  const lines = inputLines(input);
  let stdout = '';
  const {diagnostics} = run(source, {
    write: (line) => {
      stdout += `${line}\n`;
    },
    read: (prompt) => {
      const answer = lines.shift()?.replace(/\r$/, '') ?? null;
      stdout += `${prompt}${answer ?? ''}\n`;
      return answer;
    },
  });
  if (diagnostics.length === 0) {
    return {stdout, stderr: '', exitCode: 0};
  }
  return {stdout, stderr: `${formatDiagnostic(diagnostics[0])}\n`, exitCode: 1};
};

// Compila a WebAssembly independiente y lo ejecuta con WASI
const runStandalone = async (source: string, input = ''): Promise<WasiRunResult> => {
  const {binary, diagnostics} = compile(source, {target: 'wasi'});
  expect(diagnostics).toEqual([]);
  return runWasiModule(binary!, input);
};

// Verifica que el módulo independiente se comporte igual que el intérprete en la terminal
const expectSameAsInterpreter = async (source: string, input = ''): Promise<WasiRunResult> => {
  const result = await runStandalone(source, input);
  expect(result).toEqual(interpretAsTerminal(source, input));
  return result;
};

describe('módulo independiente', () => {
  // Solo importa funciones de WASI y exporta lo que espera un ejecutor como wasmtime
  test('depende solo de WASI', () => {
    const {program, types} = check('mostrar("hola", [1, 2], leer(""))');
    const {module} = compileProgram(program!, types!, {target: 'wasi'});
    expect(new Set(module!.imports.map((imported) => imported.module))).toEqual(new Set([WASI_MODULE]));
    expect(module!.exports.map((entry) => entry.name).sort()).toEqual(['_start', 'memory']);
    expect(WebAssembly.validate(encodeModule(module!))).toBe(true);
  });

  // El runtime ofrece cada operación del anfitrión con la misma firma, cambiando las referencias por direcciones
  test('el runtime reemplaza a cada función del anfitrión', () => {
    const runtime = new Map(runtimeFunctions(1).map((fn) => [fn.name, fn]));
    for (const [name, signature] of Object.entries(hostSignatures)) {
      const fn = runtime.get(name);
      expect(fn, name).toBeDefined();
      const asAddresses = (types: readonly string[]) => types.map((type) => type.replace('externref', 'i32'));
      expect(fn!.params.map(([, type]) => type), name).toEqual(asAddresses(signature.params));
      expect(fn!.results, name).toEqual(asAddresses(signature.results));
    }
  });
});

describe('ejemplos', () => {
  const examples = readdirSync(examplesDirectory).filter((file) => file.endsWith('.kun') && file !== 'error.kun');

  // Cada ejemplo muestra lo mismo que el intérprete, con su entrada si tiene
  test.each(examples)('%s se ejecuta igual sin JavaScript', async (file) => {
    await expectSameAsInterpreter(readFileSync(`${examplesDirectory}/${file}`, 'utf8'), exampleInput(file));
  });
});

describe('equivalencia con el intérprete', () => {
  // Números, textos y listas se muestran igual, incluidos los decimales difíciles
  test('muestra los valores igual', async () => {
    await expectSameAsInterpreter([
      'mostrar(1 + 2 * 3, 7 / 2, 7 % 3, -7 % 3, 5.5 % 2, 0.1 + 0.2, 1 / 3, -2 / 3)',
      'mostrar(100000000000000000000, 1000000000000000000000, 0.000001, 0.0000001, 123456789.123)',
      'mostrar(verdadero, falso, "texto", [1, 2.5], ["a", "b\\"c"], [[verdadero], [falso]])',
      'var t = "ñandú"',
      'mostrar(longitud(t), t[0], t[4], "año" < "árbol", "kuntur" == "kuntur", [1, 2] == [1, 2], ["a"] != ["b"])',
      'mostrar("n: " + 5 + " " + verdadero + " " + [1, 2], texto(2.5) + "!", tipo(1), tipo("t"), tipo([1]), tipo(falso))',
    ].join('\n'));
  });

  // Los decimales se escriben con la forma más corta que vuelve al mismo número, como en JavaScript
  test('escribe los decimales igual que JavaScript', async () => {
    await expectSameAsInterpreter([
      'var semilla = 12345.0',
      'para i desde 1 hasta 300 {',
      '  semilla = (semilla * 16807) % 2147483647',
      '  var x = semilla / 2147483647',
      '  var escala = 1.0',
      '  para j desde 1 hasta semilla % 30 {',
      '    escala = escala * 10',
      '  }',
      '  mostrar(x, x * escala, x / escala, -x * 1234.5678)',
      '}',
    ].join('\n'));
  });

  // Listas: agregar, quitar, modificar, unir y anidar
  test('maneja las listas igual', async () => {
    await expectSameAsInterpreter([
      'var l: lista de entero = [3, 1]',
      'agregar(l, 4)',
      'l[0] = 10',
      'var ultimo = quitar(l)',
      'var matriz: lista de lista de texto = [["a"], ["b", "c"]]',
      'agregar(matriz[0], "z")',
      'mostrar(l, ultimo, longitud(l), l + [7], matriz, matriz[1][0], longitud(matriz[0]))',
    ].join('\n'));
  });

  // Ciclos, funciones, recursión y llamadas a mostrar dentro de mostrar
  test('ejecuta el control de flujo igual', async () => {
    await expectSameAsInterpreter([
      'funcion fib(n: entero): entero {',
      '  si n < 2 {',
      '    retornar n',
      '  }',
      '  retornar fib(n - 1) + fib(n - 2)',
      '}',
      'funcion doble(n: entero): entero {',
      '  mostrar("calculando", n)',
      '  retornar n * 2',
      '}',
      'para i desde 6 hasta 0 paso -3 {',
      '  mostrar(i, fib(i))',
      '}',
      'var n = 0',
      'mientras verdadero {',
      '  n = n + 1',
      '  si n % 2 == 0 {',
      '    continuar',
      '  }',
      '  si n > 5 {',
      '    romper',
      '  }',
      '  mostrar(n)',
      '}',
      'mostrar("resultado:", doble(4), falso y doble(1) > 0)',
    ].join('\n'));
  });

  // Conversiones de texto a número, válidas e inválidas
  test('convierte textos en números igual', async () => {
    await expectSameAsInterpreter([
      'mostrar(numero("3.14"), numero(" -0.5 "), numero("42"), numero("1.0000000000000002"), numero("123456789.123456789"))',
      'mostrar(redondear(2.5), redondear(-2.5), raiz(2), raiz(16))',
    ].join('\n'));
  });

  // `leer` toma las líneas de la entrada estándar y repite la respuesta cuando la entrada es un archivo
  test('lee la entrada igual', async () => {
    const source = 'var nombre = leer("Nombre: ")\nvar edad = numero(leer("Edad: "))\nmostrar("Hola,", nombre, edad + 1, leer("") == "")';
    await expectSameAsInterpreter(source, 'Ana\n20\n\n');
    await expectSameAsInterpreter(source, 'Ana\r\n20');
  });

  // `aleatorio` usa el azar de WASI y respeta los límites
  test('genera números al azar dentro de los límites', async () => {
    const {stdout} = await runStandalone('para i desde 1 hasta 200 {\n  mostrar(aleatorio(1, 6))\n}');
    const values = stdout.trim().split('\n').map(Number);
    expect(values.every((value) => Number.isInteger(value) && value >= 1 && value <= 6)).toBe(true);
    expect(new Set(values).size).toBeGreaterThan(1);
  });
});

describe('errores de ejecución', () => {
  // Cada error se escribe en la salida de errores con el mismo mensaje y la misma posición, y el programa termina con 1
  test.each([
    ['división entre cero', 'mostrar("antes")\nvar cero = 0\nmostrar(1 / cero)', ''],
    ['posición fuera de la lista', 'var l = [1, 2, 3]\nmostrar(l[3])', ''],
    ['lista vacía', 'var l: lista de entero = []\nmostrar(l[0])', ''],
    ['posición de un texto', 'var t = "hola"\nmostrar(t[10])', ''],
    ['quitar de una lista vacía', 'var l: lista de entero = []\nquitar(l)', ''],
    ['texto que no es número', 'mostrar(numero("abc\\"x"))', ''],
    ['raíz de un negativo', 'mostrar(raiz(-4.5))', ''],
    ['paso cero', 'var p = 0\npara i desde 1 hasta 3 paso p {\n}', ''],
    ['aleatorio al revés', 'mostrar(aleatorio(10, 1))', ''],
    ['entrada agotada', 'var a = leer("a: ")\nvar b = leer("b: ")', 'uno'],
    ['global antes de declararla', 'funcion ver(): entero {\n  retornar total\n}\nmostrar(ver())\nvar total = 5', ''],
    ['recursión infinita', 'funcion f(n: entero): entero {\n  retornar f(n + 1)\n}\nmostrar(f(0))', ''],
  ])('%s', async (_, source, input) => {
    const result = await expectSameAsInterpreter(source, input);
    expect(result.exitCode).toBe(1);
  });

  // Los ciclos infinitos se cortan con el mismo límite de pasos
  test('corta los ciclos infinitos', async () => {
    const source = 'mientras verdadero {\n}';
    const {binary} = compile(source, {target: 'wasi', maxSteps: 1000});
    const result = await runWasiModule(binary!);
    const {diagnostics} = run(source, {maxSteps: 1000});
    expect(result.stderr).toBe(`${formatDiagnostic(diagnostics[0])}\n`);
  });
});
