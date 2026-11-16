import {describe, expect, test} from 'vitest';
import {LineEditor, toTerminalText} from '../../vscode/src/lineEditor.js';
import {tokenColumns} from '../../vscode/src/ranges.js';

describe('rango del error', () => {
  // Subraya el token completo donde empieza el error
  test('abarca el token completo', () => {
    expect(tokenColumns('mostrar(edda)', 9)).toEqual({start: 8, end: 12});
    expect(tokenColumns('var t = "hola mundo" + 1', 9)).toEqual({start: 8, end: 20});
    expect(tokenColumns("p'akiy", 1)).toEqual({start: 0, end: 6});
    expect(tokenColumns('x >= 3.5', 3)).toEqual({start: 2, end: 4});
    expect(tokenColumns('x >= 3.5', 6)).toEqual({start: 5, end: 8});
  });

  // Fuera del texto de la línea marca un solo carácter
  test('marca un carácter al final de la línea', () => {
    expect(tokenColumns('si x {', 20)).toEqual({start: 6, end: 7});
  });
});

describe('terminal de la extensión', () => {
  // Muestra lo que se escribe y entrega la línea al presionar Enter
  test('arma líneas con Enter y retroceso', () => {
    const editor = new LineEditor();
    expect(editor.input('Añ')).toEqual({echo: 'Añ', lines: [], interrupt: false, endOfInput: false});
    expect(editor.input('x\x7f')).toEqual({echo: 'x\b \b', lines: [], interrupt: false, endOfInput: false});
    expect(editor.input('a\r')).toEqual({echo: 'a\r\n', lines: ['Aña'], interrupt: false, endOfInput: false});
  });

  // Lo pegado con varias líneas se entrega línea por línea
  test('entrega varias líneas pegadas', () => {
    expect(new LineEditor().input('1\n2\n').lines).toEqual(['1', '2']);
  });

  // Ctrl + C detiene el programa y Ctrl + D termina la entrada; las flechas no cambian la línea
  test('reconoce las teclas de control', () => {
    const editor = new LineEditor();
    expect(editor.input('\x03').interrupt).toBe(true);
    expect(editor.input('\x04').endOfInput).toBe(true);
    expect(editor.input('\x1b[A')).toEqual({echo: '', lines: [], interrupt: false, endOfInput: false});
  });

  // La terminal necesita retorno de carro en cada salto de línea
  test('adapta los saltos de línea', () => {
    expect(toTerminalText('a\nb\r\nc')).toBe('a\r\nb\r\nc');
  });
});
