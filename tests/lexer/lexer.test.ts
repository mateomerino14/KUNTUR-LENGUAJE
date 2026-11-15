import {describe, expect, test} from 'vitest';
import {tokenize} from '../../src/lexer/lexer.js';
import {TokenType} from '../../src/lexer/token.js';

// Devuelve solo los tipos de los tokens, para comparar secuencias
const typesOf = (source: string): TokenType[] => tokenize(source).tokens.map((token) => token.type);

// Devuelve los mensajes de error del análisis léxico
const messagesOf = (source: string): string[] => tokenize(source).diagnostics.map((diagnostic) => diagnostic.message);

describe('palabras clave e identificadores', () => {
  // Las palabras clave en español se reconocen como tales
  test('reconoce las palabras clave en español', () => {
    expect(typesOf('si sino mientras para desde hasta paso')).toEqual([
      TokenType.If, TokenType.Else, TokenType.While, TokenType.For,
      TokenType.From, TokenType.To, TokenType.Step, TokenType.EndOfFile,
    ]);
  });

  // `función` con tilde y sin tilde son la misma palabra clave
  test('acepta funcion con y sin tilde', () => {
    expect(typesOf('funcion función')).toEqual([TokenType.Function, TokenType.Function, TokenType.EndOfFile]);
  });

  // Los nombres pueden llevar tildes y ñ
  test('acepta identificadores con tildes y eñe', () => {
    const {tokens} = tokenize('año contraseña_1 número');
    expect(tokens.slice(0, 3).map((token) => token.lexeme)).toEqual(['año', 'contraseña_1', 'número']);
    expect(tokens.slice(0, 3).every((token) => token.type === TokenType.Identifier)).toBe(true);
  });

  // Una palabra que empieza como palabra clave sigue siendo un identificador
  test('no confunde identificadores que contienen palabras clave', () => {
    expect(typesOf('sino_tal siempre')).toEqual([TokenType.Identifier, TokenType.Identifier, TokenType.EndOfFile]);
  });
});

describe('literales', () => {
  // Los números enteros y decimales guardan su valor
  test('lee números enteros y decimales', () => {
    const {tokens} = tokenize('42 3.14');
    expect(tokens[0].literal).toBe(42);
    expect(tokens[1].literal).toBe(3.14);
  });

  // Los textos guardan su valor sin comillas y con los escapes resueltos
  test('lee textos con secuencias de escape', () => {
    const {tokens} = tokenize('"hola\\n\\"mundo\\""');
    expect(tokens[0].type).toBe(TokenType.String);
    expect(tokens[0].literal).toBe('hola\n"mundo"');
  });
});

describe('operadores', () => {
  // Los operadores de dos caracteres se leen como uno solo
  test('distingue operadores simples y dobles', () => {
    expect(typesOf('= == != < <= > >=')).toEqual([
      TokenType.Equal, TokenType.EqualEqual, TokenType.BangEqual,
      TokenType.Less, TokenType.LessEqual, TokenType.Greater, TokenType.GreaterEqual,
      TokenType.EndOfFile,
    ]);
  });

  // Los comentarios se ignoran hasta el final de la línea
  test('ignora los comentarios', () => {
    expect(typesOf('x // esto es un comentario')).toEqual([TokenType.Identifier, TokenType.EndOfFile]);
  });
});

describe('saltos de línea', () => {
  // Un salto de línea después de un valor termina la sentencia
  test('inserta fin de sentencia tras un valor', () => {
    expect(typesOf('x = 1\nz = 2')).toEqual([
      TokenType.Identifier, TokenType.Equal, TokenType.Number, TokenType.Newline,
      TokenType.Identifier, TokenType.Equal, TokenType.Number, TokenType.EndOfFile,
    ]);
  });

  // Un salto de línea después de un operador no corta la expresión
  test('no corta la expresión tras un operador', () => {
    expect(typesOf('x = 1 +\n2')).not.toContain(TokenType.Newline);
  });

  // Dentro de paréntesis o corchetes los saltos de línea se ignoran
  test('ignora saltos de línea dentro de paréntesis y corchetes', () => {
    expect(typesOf('f(\n1,\n2\n)')).not.toContain(TokenType.Newline);
    expect(typesOf('[\n1,\n2\n]')).not.toContain(TokenType.Newline);
  });

  // Las líneas vacías no generan fines de sentencia repetidos
  test('no repite el fin de sentencia en líneas vacías', () => {
    expect(typesOf('x\n\n\nz').filter((type) => type === TokenType.Newline)).toHaveLength(1);
  });

  // Cada token guarda la línea y la columna donde empieza
  test('registra la línea y la columna de cada token', () => {
    const {tokens} = tokenize('var x = 1\n  mostrar(x)');
    const call = tokens.find((token) => token.lexeme === 'mostrar');
    expect(call?.position).toEqual({line: 2, column: 3});
  });
});

describe('errores léxicos', () => {
  // Un texto sin cerrar indica dónde empieza
  test('informa un texto sin comillas de cierre', () => {
    const {diagnostics} = tokenize('var x = "hola');
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain('no tiene comillas de cierre');
    expect(diagnostics[0].position).toEqual({line: 1, column: 9});
  });

  // Los operadores de otros lenguajes sugieren la palabra de Kuntur
  test('sugiere y, o y no en lugar de &&, || y !', () => {
    expect(messagesOf('a && b')[0]).toContain('usa `y`');
    expect(messagesOf('a || b')[0]).toContain('usa `o`');
    expect(messagesOf('!a')[0]).toContain('usa `no`');
  });

  // Un nombre que empieza con número se explica
  test('informa un nombre que empieza con un número', () => {
    expect(messagesOf('var 2x = 1')[0]).toBe('`2x` no es un nombre válido: los nombres no pueden empezar con un número.');
  });

  // Los caracteres desconocidos se informan y el análisis continúa
  test('informa caracteres desconocidos y sigue analizando', () => {
    const {tokens, diagnostics} = tokenize('a @ b # c');
    expect(diagnostics).toHaveLength(2);
    expect(diagnostics[0].message).toBe('El carácter `@` no forma parte del lenguaje.');
    expect(tokens.filter((token) => token.type === TokenType.Identifier)).toHaveLength(3);
  });

  // Una secuencia de escape desconocida se informa
  test('informa una secuencia de escape inválida', () => {
    expect(messagesOf('"a\\qb"')[0]).toContain('`\\q` no es válida');
  });
});
