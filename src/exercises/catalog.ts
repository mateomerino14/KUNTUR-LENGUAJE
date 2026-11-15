export type ExerciseLevel = 'easy' | 'medium' | 'challenge';

export interface TestCase {
  input: string[];
  output: string[];
  visible: boolean;
}

export interface Exercise {
  id: string;
  title: string;
  level: ExerciseLevel;
  summary: string;
  statement: string[];
  starter: string;
  tests: TestCase[];
}

export const EXERCISE_LEVELS: {id: ExerciseLevel; label: string}[] = [
  {id: 'easy', label: 'Fácil'},
  {id: 'medium', label: 'Intermedio'},
  {id: 'challenge', label: 'Desafío'},
];

// Crea un caso de prueba que se muestra como ejemplo
const shown = (input: string[], output: string[]): TestCase => ({input, output, visible: true});

// Crea un caso de prueba oculto, que solo dice si pasó
const hidden = (input: string[], output: string[]): TestCase => ({input, output, visible: false});

// Tabla de multiplicar esperada para un número
const table = (n: number): string[] => Array.from({length: 10}, (_, index) => `${n} x ${index + 1} = ${n * (index + 1)}`);

export const EXERCISES: Exercise[] = [
  {
    id: 'saludo',
    title: 'Saluda por nombre',
    level: 'easy',
    summary: 'Lee un nombre y salúdalo',
    statement: [
      'Lee un nombre con `leer` y muestra un saludo con el formato `¡Hola, Ana!`.',
    ],
    starter: 'var nombre = leer("¿Cómo te llamas? ")\n\n// Muestra el saludo aquí\n',
    tests: [
      shown(['Ana'], ['¡Hola, Ana!']),
      hidden(['Luis Fernando'], ['¡Hola, Luis Fernando!']),
      hidden(['Ñusta'], ['¡Hola, Ñusta!']),
    ],
  },
  {
    id: 'par-impar',
    title: '¿Par o impar?',
    level: 'easy',
    summary: 'Decide con el residuo %',
    statement: [
      'Lee un número entero y muestra `par` si es par o `impar` si no lo es.',
      'Pista: un número es par cuando el residuo de dividirlo entre 2 es 0.',
    ],
    starter: 'var n = redondear(numero(leer("Número: ")))\n\n',
    tests: [
      shown(['4'], ['par']),
      shown(['7'], ['impar']),
      hidden(['0'], ['par']),
      hidden(['-3'], ['impar']),
    ],
  },
  {
    id: 'suma',
    title: 'Suma de 1 a N',
    level: 'easy',
    summary: 'Tu primer ciclo para',
    statement: [
      'Lee un número N y muestra la suma 1 + 2 + ... + N.',
      'Si N es 0, la suma es 0.',
    ],
    starter: 'var n = redondear(numero(leer("N: ")))\nvar suma = 0\n\n',
    tests: [
      shown(['5'], ['15']),
      hidden(['100'], ['5050']),
      hidden(['1'], ['1']),
      hidden(['0'], ['0']),
    ],
  },
  {
    id: 'mayor',
    title: 'El mayor de tres',
    level: 'easy',
    summary: 'Compara con si y sino',
    statement: [
      'Lee tres números, que pueden tener decimales, y muestra el mayor.',
    ],
    starter: 'var a = numero(leer("Primero: "))\nvar b = numero(leer("Segundo: "))\nvar c = numero(leer("Tercero: "))\n\n',
    tests: [
      shown(['3', '9', '4'], ['9']),
      hidden(['-1', '-5', '-2'], ['-1']),
      hidden(['2.5', '2.5', '1'], ['2.5']),
      hidden(['7', '7.5', '7.25'], ['7.5']),
    ],
  },
  {
    id: 'tabla',
    title: 'Tabla de multiplicar',
    level: 'medium',
    summary: 'Diez líneas con un formato exacto',
    statement: [
      'Lee un número y muestra su tabla de multiplicar del 1 al 10, una línea por resultado, con el formato `7 x 3 = 21`.',
      'Pista: `mostrar` separa sus valores con un espacio.',
    ],
    starter: 'var n = redondear(numero(leer("Tabla del: ")))\n\n',
    tests: [
      shown(['7'], table(7)),
      hidden(['1'], table(1)),
      hidden(['12'], table(12)),
    ],
  },
  {
    id: 'pasaje',
    title: 'Pasajes en micro',
    level: 'medium',
    summary: 'Precios con decimales',
    statement: [
      'En este ejercicio, el pasaje en micro cuesta Bs 1.50 para adultos y Bs 1 para estudiantes.',
      'Lee cuántos adultos y cuántos estudiantes suben, y muestra el total con el formato `Total: Bs 5.5`.',
    ],
    starter: 'var adultos = numero(leer("Adultos: "))\nvar estudiantes = numero(leer("Estudiantes: "))\n\n',
    tests: [
      shown(['3', '1'], ['Total: Bs 5.5']),
      hidden(['2', '2'], ['Total: Bs 5']),
      hidden(['0', '0'], ['Total: Bs 0']),
      hidden(['10', '5'], ['Total: Bs 20']),
    ],
  },
  {
    id: 'vocales',
    title: 'Contar vocales',
    level: 'medium',
    summary: 'Recorre un texto letra por letra',
    statement: [
      'Lee una frase y muestra cuántas vocales tiene: a, e, i, o, u, en minúscula o en mayúscula. Las vocales con tilde no cuentan.',
      'Pista: `frase[i]` es la letra en la posición i, y `longitud(frase)` dice cuántas hay.',
    ],
    starter: 'var frase = leer("Frase: ")\nvar vocales = 0\n\n',
    tests: [
      shown(['Cochabamba'], ['4']),
      hidden(['Hola Mundo'], ['4']),
      hidden(['xyz'], ['0']),
      hidden(['AEIOU aeiou'], ['10']),
    ],
  },
  {
    id: 'aprobados',
    title: 'Notas del curso',
    level: 'medium',
    summary: 'Promedio y conteo en un mismo ciclo',
    statement: [
      'Lee cuántas notas hay y después cada nota.',
      'Muestra el promedio redondeado con el formato `Promedio: 65` y, en otra línea, cuántas notas son de 51 o más con el formato `Aprobados: 2`.',
    ],
    starter: 'var cantidad = redondear(numero(leer("Cantidad: ")))\n\n',
    tests: [
      shown(['3', '70', '85', '40'], ['Promedio: 65', 'Aprobados: 2']),
      hidden(['1', '51'], ['Promedio: 51', 'Aprobados: 1']),
      hidden(['4', '10', '20', '30', '50'], ['Promedio: 28', 'Aprobados: 0']),
      hidden(['2', '100', '100'], ['Promedio: 100', 'Aprobados: 2']),
    ],
  },
  {
    id: 'primo',
    title: '¿Es primo?',
    level: 'challenge',
    summary: 'Busca divisores con un ciclo',
    statement: [
      'Lee un número entero mayor que 1 y muestra `primo` si solo se puede dividir entre 1 y sí mismo, o `no es primo` si tiene otro divisor.',
    ],
    starter: 'var n = redondear(numero(leer("Número: ")))\n\n',
    tests: [
      shown(['7'], ['primo']),
      shown(['9'], ['no es primo']),
      hidden(['2'], ['primo']),
      hidden(['97'], ['primo']),
      hidden(['91'], ['no es primo']),
    ],
  },
  {
    id: 'invertir',
    title: 'Al revés',
    level: 'challenge',
    summary: 'Arma un texto nuevo de atrás para adelante',
    statement: [
      'Lee una palabra y muéstrala al revés: `kuntur` se convierte en `rutnuk`.',
      'Pista: los textos no se pueden modificar por posición, pero puedes ir armando uno nuevo con `+`.',
    ],
    starter: 'var palabra = leer("Palabra: ")\nvar alReves = ""\n\n',
    tests: [
      shown(['kuntur'], ['rutnuk']),
      hidden(['Cochabamba'], ['abmabahcoC']),
      hidden(['a'], ['a']),
      hidden(['ñandú'], ['údnañ']),
    ],
  },
  {
    id: 'fibonacci',
    title: 'Fibonacci',
    level: 'challenge',
    summary: 'Cada número es la suma de los dos anteriores',
    statement: [
      'Lee un número N y muestra los primeros N números de Fibonacci en una sola línea, separados por un espacio: para 6 es `0 1 1 2 3 5`.',
      'La serie empieza con 0 y 1, y cada número siguiente es la suma de los dos anteriores.',
    ],
    starter: 'var n = redondear(numero(leer("N: ")))\n\n',
    tests: [
      shown(['6'], ['0 1 1 2 3 5']),
      hidden(['1'], ['0']),
      hidden(['2'], ['0 1']),
      hidden(['10'], ['0 1 1 2 3 5 8 13 21 34']),
    ],
  },
];
