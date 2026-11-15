import {describe, expect, test} from 'vitest';
import {tokenize} from '../../src/lexer/lexer.js';
import type {Expression, Program, Statement} from '../../src/parser/ast.js';
import {parseTokens} from '../../src/parser/parser.js';
import {printExpression} from '../../src/parser/printer.js';

// Analiza el código fuente completo, del texto al árbol
const parseSource = (source: string) => parseTokens(tokenize(source).tokens);

// Devuelve el programa y falla si hubo errores de sintaxis
const parseValid = (source: string): Program => {
  const {program, diagnostics} = parseSource(source);
  expect(diagnostics.map((diagnostic) => diagnostic.message)).toEqual([]);
  return program;
};

// Devuelve la expresión de la única sentencia del programa
const expressionOf = (source: string): Expression => {
  const statement = parseValid(source).statements[0];
  if (statement.kind !== 'ExpressionStatement') {
    throw new Error(`Se esperaba una expresión y se obtuvo ${statement.kind}`);
  }
  return statement.expression;
};

// Escribe la expresión agrupada para comparar la precedencia
const grouped = (source: string): string => printExpression(expressionOf(source));

// Devuelve los mensajes de error de sintaxis
const messagesOf = (source: string): string[] => parseSource(source).diagnostics.map((diagnostic) => diagnostic.message);

// Devuelve la primera sentencia del programa
const firstStatement = (source: string): Statement => parseValid(source).statements[0];

describe('precedencia de operadores', () => {
  // La multiplicación se agrupa antes que la suma
  test('multiplica antes de sumar', () => {
    expect(grouped('1 + 2 * 3')).toBe('(+ 1 (* 2 3))');
    expect(grouped('(1 + 2) * 3')).toBe('(* (+ 1 2) 3)');
  });

  // La resta se agrupa de izquierda a derecha
  test('agrupa la resta de izquierda a derecha', () => {
    expect(grouped('10 - 3 - 2')).toBe('(- (- 10 3) 2)');
  });

  // La asignación se agrupa de derecha a izquierda
  test('agrupa la asignación de derecha a izquierda', () => {
    expect(grouped('a = b = 3')).toBe('(= a (= b 3))');
  });

  // `y` se agrupa antes que `o`, y las comparaciones antes que ambos
  test('ordena los operadores lógicos y las comparaciones', () => {
    expect(grouped('a o b y c')).toBe('(o a (y b c))');
    expect(grouped('x > 1 y x < 10')).toBe('(y (> x 1) (< x 10))');
  });

  // `no` niega la comparación completa, como se lee en español
  test('aplica no sobre la comparación completa', () => {
    expect(grouped('no x == 5')).toBe('(no (== x 5))');
    expect(grouped('no a y b')).toBe('(y (no a) b)');
  });

  // El menos unario se aplica antes que la multiplicación
  test('aplica el menos unario antes que la multiplicación', () => {
    expect(grouped('-2 * 3')).toBe('(* (- 2) 3)');
  });

  // Llamadas y posiciones se encadenan
  test('encadena llamadas y posiciones', () => {
    expect(grouped('matriz[1][2]')).toBe('(posicion (posicion matriz 1) 2)');
    expect(grouped('f(1, g(2))[0]')).toBe('(posicion (llamar f 1 (llamar g 2)) 0)');
  });

  // Las listas admiten saltos de línea y una coma final
  test('lee listas en varias líneas con coma final', () => {
    expect(grouped('[\n  1,\n  2,\n]')).toBe('[1 2]');
  });
});

describe('sentencias', () => {
  // La declaración guarda el nombre, el tipo y el valor inicial
  test('lee declaraciones con tipo opcional', () => {
    const statement = firstStatement('var edad: entero = 20');
    expect(statement).toMatchObject({kind: 'VarDeclaration', name: 'edad', constant: false, typeAnnotation: {name: 'entero'}});
  });

  // `lista de tipo` guarda el tipo de los elementos, también anidado
  test('lee tipos de listas', () => {
    expect(firstStatement('var notas: lista de entero = []')).toMatchObject({
      typeAnnotation: {name: 'lista', element: {name: 'entero', element: null}},
    });
    expect(firstStatement('var matriz: lista de lista de decimal = []')).toMatchObject({
      typeAnnotation: {name: 'lista', element: {name: 'lista', element: {name: 'decimal'}}},
    });
  });

  // Las constantes se marcan como tales
  test('lee constantes', () => {
    expect(firstStatement('constante PI = 3.14')).toMatchObject({kind: 'VarDeclaration', constant: true});
  });

  // La función guarda sus parámetros, el tipo de retorno y el cuerpo
  test('lee funciones con parámetros tipados', () => {
    const statement = firstStatement('funcion suma(a: entero, b: entero): entero {\n  retornar a + b\n}');
    expect(statement).toMatchObject({
      kind: 'FunctionDeclaration',
      name: 'suma',
      params: [{name: 'a', typeAnnotation: {name: 'entero'}}, {name: 'b'}],
      returnType: {name: 'entero'},
    });
  });

  // `sino si` encadena condicionales y `sino` puede ir en la línea siguiente
  test('lee si, sino si y sino', () => {
    const source = 'si x > 0 {\n  a()\n}\nsino si x < 0 {\n  b()\n}\nsino {\n  c()\n}';
    const statement = firstStatement(source);
    expect(statement).toMatchObject({kind: 'If', elseBranch: {kind: 'If', elseBranch: {kind: 'Block'}}});
  });

  // Un `si` sin `sino` no consume la sentencia siguiente
  test('no confunde la sentencia siguiente con un sino', () => {
    const program = parseValid('si x {\n  a()\n}\nb()');
    expect(program.statements.map((statement) => statement.kind)).toEqual(['If', 'ExpressionStatement']);
  });

  // El ciclo `para` lee el inicio, el fin y el paso
  test('lee el ciclo para con paso', () => {
    expect(firstStatement('para i desde 10 hasta 0 paso -2 {\n}')).toMatchObject({
      kind: 'For', variable: 'i', start: {value: 10}, end: {value: 0}, step: {kind: 'Unary'},
    });
  });

  // Se pueden escribir varias sentencias en una línea separadas por `;`
  test('acepta punto y coma entre sentencias', () => {
    expect(parseValid('var a = 1; var b = 2').statements).toHaveLength(2);
  });
});

describe('errores de sintaxis', () => {
  // Usar `=` en una condición explica la diferencia con `==`
  test('avisa del = en una condición', () => {
    expect(messagesOf('si x = 5 {\n}')[0]).toBe('En la condición del `si` se compara con `==`; un solo `=` sirve para asignar.');
  });

  // Falta un valor después de un operador
  test('informa un valor faltante después de un operador', () => {
    expect(messagesOf('var x = 1 +')[0]).toBe('Falta un valor después de `+`.');
  });

  // Un paréntesis sin cerrar indica dónde se abrió
  test('informa un paréntesis sin cerrar', () => {
    const {diagnostics} = parseSource('mostrar(1, 2');
    expect(diagnostics[0].message).toBe('Falta `)` para cerrar el `(` que se abre aquí.');
    expect(diagnostics[0].position).toEqual({line: 1, column: 8});
  });

  // Un bloque sin cerrar indica dónde se abrió
  test('informa un bloque sin llave de cierre', () => {
    const {diagnostics} = parseSource('mientras verdadero {\n  a()\n');
    expect(diagnostics[0].message).toBe('El bloque que se abre aquí no tiene `}` de cierre.');
    expect(diagnostics[0].position).toEqual({line: 1, column: 20});
  });

  // Dos sentencias en la misma línea sin separador
  test('informa algo de más después de una sentencia', () => {
    expect(messagesOf('var x = 1 2')[0]).toBe('Sobra `2` después de la sentencia; cada sentencia va en su propia línea.');
  });

  // `retornar`, `romper` y `continuar` fuera de lugar
  test('informa retornar, romper y continuar fuera de lugar', () => {
    expect(messagesOf('retornar 1')[0]).toBe('`retornar` solo se puede usar dentro de una función.');
    expect(messagesOf('romper')[0]).toBe('`romper` solo se puede usar dentro de un ciclo `mientras` o `para`.');
    expect(messagesOf('mientras verdadero {\n  funcion f() {\n    continuar\n  }\n}')[0]).toContain('`continuar` solo se puede usar');
  });

  // Asignar a algo que no es variable ni posición
  test('informa una asignación inválida', () => {
    expect(messagesOf('1 + 2 = 3')[0]).toBe('Solo se puede asignar a una variable o a una posición de una lista.');
  });

  // Una constante sin valor inicial
  test('informa una constante sin valor', () => {
    expect(messagesOf('constante PI')[0]).toContain('necesita un valor inicial');
  });

  // Un `sino` suelto
  test('informa un sino sin si', () => {
    expect(messagesOf('sino {\n}')[0]).toBe('`sino` debe ir justo después del bloque de un `si`.');
  });

  // Una llave de cierre que sobra
  test('informa una llave de cierre que sobra', () => {
    expect(messagesOf('a()\n}')[0]).toBe('Sobra esta `}`: no cierra ningún bloque.');
  });

  // El análisis se recupera y reporta errores de varias líneas
  test('reporta varios errores en una sola pasada', () => {
    const {diagnostics} = parseSource('var = 1\nvar x = 2\nvar w z\nmostrar(x)');
    expect(diagnostics.map((diagnostic) => diagnostic.position.line)).toEqual([1, 3]);
  });

  // Los errores dentro de un bloque no impiden seguir con el bloque
  test('se recupera de errores dentro de un bloque', () => {
    const {program, diagnostics} = parseSource('funcion f() {\n  var = 1\n  retornar 2\n}\nf()');
    expect(diagnostics).toHaveLength(1);
    expect(program.statements.map((statement) => statement.kind)).toEqual(['FunctionDeclaration', 'ExpressionStatement']);
  });
});

describe('números', () => {
  // Un número escrito con punto se marca como decimal aunque su valor sea entero
  test('distingue los números escritos con punto decimal', () => {
    expect(expressionOf('2.0')).toMatchObject({kind: 'NumberLiteral', value: 2, decimal: true});
    expect(expressionOf('2')).toMatchObject({kind: 'NumberLiteral', value: 2, decimal: false});
  });
});
