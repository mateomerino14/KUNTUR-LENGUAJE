import {createDiagnostic, type Diagnostic, type Position} from '../errors/diagnostic.js';
import {constantTailLength, localizeMessage, QUECHUA_WORDS, type Language} from '../language/quechua.js';
import {keywords, statementEnders, TokenType, type Token} from './token.js';

export interface LexResult {
  tokens: Token[];
  diagnostics: Diagnostic[];
}

const singleCharTokens: ReadonlyMap<string, TokenType> = new Map([
  ['+', TokenType.Plus],
  ['-', TokenType.Minus],
  ['*', TokenType.Star],
  ['/', TokenType.Slash],
  ['%', TokenType.Percent],
  ['(', TokenType.LeftParen],
  [')', TokenType.RightParen],
  ['{', TokenType.LeftBrace],
  ['}', TokenType.RightBrace],
  ['[', TokenType.LeftBracket],
  [']', TokenType.RightBracket],
  [',', TokenType.Comma],
  ['.', TokenType.Dot],
  [':', TokenType.Colon],
  [';', TokenType.Semicolon],
]);

const groupOpeners: ReadonlySet<TokenType> = new Set([TokenType.LeftParen, TokenType.LeftBracket]);
const groupClosers: ReadonlySet<TokenType> = new Set([TokenType.RightParen, TokenType.RightBracket]);

const escapeSequences: ReadonlyMap<string, string> = new Map([
  ['n', '\n'],
  ['t', '\t'],
  ['"', '"'],
  ['\\', '\\'],
]);

const foreignOperators: ReadonlyMap<string, string> = new Map([
  ['&&', 'El símbolo `&&` no existe en Kuntur; para unir condiciones usa `y`.'],
  ['||', 'El símbolo `||` no existe en Kuntur; para elegir entre condiciones usa `o`.'],
]);

// Indica si el carácter es un dígito del 0 al 9
const isDigit = (char: string): boolean => char >= '0' && char <= '9';

// Indica si el carácter puede iniciar un identificador, incluidas letras con tilde y la ñ
const isIdentifierStart = (char: string): boolean => /[\p{L}_]/u.test(char);

// Indica si el carácter puede continuar un identificador
const isIdentifierPart = (char: string): boolean => /[\p{L}\p{N}_]/u.test(char);

class Lexer {
  private readonly source: string;
  private readonly tokens: Token[] = [];
  private readonly diagnostics: Diagnostic[] = [];
  private index = 0;
  private line = 1;
  private column = 1;
  private groupDepth = 0;
  private tokenStart: Position = {line: 1, column: 1};
  private tokenStartIndex = 0;
  private readonly language: Language;

  constructor(source: string, language: Language) {
    this.source = source;
    this.language = language;
  }

  // Recorre todo el código fuente y devuelve los tokens con los errores encontrados
  tokenize(): LexResult {
    while (!this.isAtEnd()) {
      this.markTokenStart();
      this.scanToken();
    }
    this.markTokenStart();
    this.addToken(TokenType.EndOfFile, null);
    return {tokens: this.tokens, diagnostics: this.diagnostics};
  }

  // Analiza un token a partir del carácter actual
  private scanToken(): void {
    const char = this.advance();
    if (char === ' ' || char === '\t' || char === '\r') {
      return;
    }
    if (char === '\n') {
      this.handleNewline();
      return;
    }
    if (char === '/' && this.peek() === '/') {
      this.skipComment();
      return;
    }
    if (char === '"') {
      this.scanString();
      return;
    }
    if (isDigit(char)) {
      this.scanNumber();
      return;
    }
    if (isIdentifierStart(char)) {
      this.scanIdentifier();
      return;
    }
    this.scanSymbol(char);
  }

  // Termina la sentencia en el salto de línea cuando lo anterior puede cerrarla
  private handleNewline(): void {
    const lastToken = this.tokens.at(-1);
    if (this.groupDepth === 0 && lastToken !== undefined && statementEnders.has(lastToken.type)) {
      this.addToken(TokenType.Newline, null);
    }
    this.line++;
    this.column = 1;
  }

  // Ignora un comentario hasta el final de la línea, sin consumir el salto
  private skipComment(): void {
    while (!this.isAtEnd() && this.peek() !== '\n') {
      this.advance();
    }
  }

  // Lee un texto entre comillas dobles y resuelve sus secuencias de escape
  private scanString(): void {
    let value = '';
    while (!this.isAtEnd() && this.peek() !== '"' && this.peek() !== '\n') {
      const char = this.advance();
      if (char !== '\\') {
        value += char;
        continue;
      }
      if (this.isAtEnd() || this.peek() === '\n') {
        break;
      }
      const escaped = this.advance();
      const resolved = escapeSequences.get(escaped);
      if (resolved === undefined) {
        this.reportAt(
          `La secuencia \`\\${escaped}\` no es válida dentro de un texto. Usa \`\\n\`, \`\\t\`, \`\\"\` o \`\\\\\`.`,
          {line: this.line, column: this.column - 2},
        );
        value += escaped;
      }
      else {
        value += resolved;
      }
    }
    if (this.isAtEnd() || this.peek() === '\n') {
      this.report('Este texto no tiene comillas de cierre. Agrega `"` al final del texto, en la misma línea.');
      return;
    }
    this.advance();
    this.addToken(TokenType.String, value);
  }

  // Lee un número entero o decimal; el decimal usa punto
  private scanNumber(): void {
    while (isDigit(this.peek())) {
      this.advance();
    }
    if (this.peek() === '.' && isDigit(this.peekNext())) {
      this.advance();
      while (isDigit(this.peek())) {
        this.advance();
      }
    }
    if (isIdentifierStart(this.peek())) {
      while (isIdentifierPart(this.peek())) {
        this.advance();
      }
      this.report(
        `\`${this.currentLexeme()}\` no es un nombre válido: los nombres no pueden empezar con un número.`,
      );
      return;
    }
    this.addToken(TokenType.Number, Number(this.currentLexeme()));
  }

  // Lee un identificador o una palabra clave del lenguaje
  private scanIdentifier(): void {
    while (isIdentifierPart(this.peek()) || this.isQuechuaApostrophe()) {
      this.advance();
    }
    let word = this.currentLexeme();
    let spelling: string | undefined;
    if (this.language === 'qu') {
      const tail = constantTailLength(word, this.source.slice(this.index, this.index + 16));
      for (let consumed = 0; consumed < tail; consumed++) {
        this.advance();
      }
      const quechua = this.currentLexeme().replace(/[ \t]+/, ' ');
      if (QUECHUA_WORDS.has(quechua)) {
        spelling = this.currentLexeme();
        word = QUECHUA_WORDS.get(quechua)!;
      }
    }
    const keywordType = keywords.get(word) ?? TokenType.Identifier;
    this.addToken(keywordType, null, word, spelling);
  }

  // En quechua, el apóstrofo es parte de la palabra cuando está entre letras, como en `p'akiy`
  private isQuechuaApostrophe(): boolean {
    return this.language === 'qu' && (this.peek() === '\'' || this.peek() === '’') && isIdentifierStart(this.peekNext());
  }

  // Lee operadores y signos de puntuación, de uno o dos caracteres
  private scanSymbol(char: string): void {
    const pair = char + this.peek();
    const foreignMessage = foreignOperators.get(pair);
    if (foreignMessage !== undefined) {
      this.advance();
      this.report(foreignMessage);
      return;
    }
    if (char === '=') {
      this.addPairOrSingle('=', TokenType.EqualEqual, TokenType.Equal);
      return;
    }
    if (char === '<') {
      this.addPairOrSingle('=', TokenType.LessEqual, TokenType.Less);
      return;
    }
    if (char === '>') {
      this.addPairOrSingle('=', TokenType.GreaterEqual, TokenType.Greater);
      return;
    }
    if (char === '!') {
      if (this.match('=')) {
        this.addToken(TokenType.BangEqual, null);
      }
      else {
        this.report('El símbolo `!` no existe en Kuntur; para negar una condición usa `no`.');
      }
      return;
    }
    const type = singleCharTokens.get(char);
    if (type === undefined) {
      this.report(`El carácter \`${char}\` no forma parte del lenguaje.`);
      return;
    }
    this.addToken(type, null);
  }

  // Agrega el token doble si sigue el carácter esperado, o el simple si no
  private addPairOrSingle(expected: string, pairType: TokenType, singleType: TokenType): void {
    if (this.match(expected)) {
      this.addToken(pairType, null);
    }
    else {
      this.addToken(singleType, null);
    }
  }

  // Registra un token con el texto leído desde su inicio
  private addToken(type: TokenType, literal: number | string | null, lexeme = this.currentLexeme(), original?: string): void {
    if (groupOpeners.has(type)) {
      this.groupDepth++;
    }
    if (groupClosers.has(type) && this.groupDepth > 0) {
      this.groupDepth--;
    }
    const token: Token = {type, lexeme, literal, position: {...this.tokenStart}};
    if (original !== undefined) {
      token.original = original;
    }
    this.tokens.push(token);
  }

  // Registra un error en la posición donde empezó el token actual
  private report(message: string): void {
    this.reportAt(message, this.tokenStart);
  }

  // Registra un error en una posición concreta
  private reportAt(message: string, position: Position): void {
    this.diagnostics.push(createDiagnostic('lexer', localizeMessage(message, this.language), position));
  }

  // Guarda la posición de inicio del siguiente token
  private markTokenStart(): void {
    this.tokenStart = {line: this.line, column: this.column};
    this.tokenStartIndex = this.index;
  }

  // Texto leído desde el inicio del token actual
  private currentLexeme(): string {
    return this.source.slice(this.tokenStartIndex, this.index);
  }

  // Consume el carácter actual y avanza la columna
  private advance(): string {
    const char = this.source[this.index];
    this.index++;
    this.column++;
    return char;
  }

  // Consume el carácter actual solo si es el esperado
  private match(expected: string): boolean {
    if (this.peek() !== expected) {
      return false;
    }
    this.advance();
    return true;
  }

  // Mira el carácter actual sin consumirlo
  private peek(): string {
    if (this.isAtEnd()) {
      return '';
    }
    return this.source[this.index];
  }

  // Mira el carácter siguiente al actual sin consumirlo
  private peekNext(): string {
    if (this.index + 1 >= this.source.length) {
      return '';
    }
    return this.source[this.index + 1];
  }

  // Indica si ya se leyó todo el código fuente
  private isAtEnd(): boolean {
    return this.index >= this.source.length;
  }
}

// Convierte el código fuente en una lista de tokens
export const tokenize = (source: string, language: Language = 'es'): LexResult => new Lexer(source, language).tokenize();
