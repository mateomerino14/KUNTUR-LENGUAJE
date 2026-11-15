import {createDiagnostic, type Diagnostic, type Position} from '../errors/diagnostic.js';
import {describeToken, TokenType, type Token} from '../lexer/token.js';
import type {
  Block,
  Expression,
  FunctionDeclaration,
  If,
  Parameter,
  Program,
  Statement,
  TypeAnnotation,
  VarDeclaration,
} from './ast.js';
import {binaryOperators, Precedence, precedenceOf} from './precedence.js';

export interface ParseResult {
  program: Program;
  diagnostics: Diagnostic[];
}

const statementStarters: ReadonlySet<TokenType> = new Set([
  TokenType.Var,
  TokenType.Const,
  TokenType.Function,
  TokenType.If,
  TokenType.While,
  TokenType.For,
  TokenType.Return,
  TokenType.Break,
  TokenType.Continue,
]);

const statementSeparators: ReadonlySet<TokenType> = new Set([TokenType.Newline, TokenType.Semicolon]);

// Error interno que corta la sentencia actual; el diagnóstico ya quedó registrado
class ParseError extends Error {}

class Parser {
  private readonly tokens: Token[];
  private readonly diagnostics: Diagnostic[] = [];
  private current = 0;
  private functionDepth = 0;
  private loopDepth = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  // Analiza el programa completo y devuelve el árbol con los errores encontrados
  parse(): ParseResult {
    const statements: Statement[] = [];
    this.skipSeparators();
    while (!this.isAtEnd()) {
      if (this.check(TokenType.RightBrace)) {
        this.report('Sobra esta `}`: no cierra ningún bloque.', this.peek().position);
        this.advance();
      }
      else {
        this.parseStatementSafely(statements);
      }
      this.skipSeparators();
    }
    return {program: {kind: 'Program', statements}, diagnostics: this.diagnostics};
  }

  // Analiza una sentencia y, si falla, se recupera para seguir con la siguiente
  private parseStatementSafely(statements: Statement[]): void {
    const startIndex = this.current;
    try {
      statements.push(this.parseStatement());
    }
    catch (error) {
      if (!(error instanceof ParseError)) {
        throw error;
      }
      if (this.current === startIndex) {
        this.advance();
      }
      this.synchronize();
    }
  }

  // Elige qué sentencia analizar según el token actual
  private parseStatement(): Statement {
    const token = this.peek();
    switch (token.type) {
      case TokenType.Var:
      case TokenType.Const:
        return this.parseVarDeclaration();
      case TokenType.Function:
        return this.parseFunctionDeclaration();
      case TokenType.Return:
        return this.parseReturn();
      case TokenType.If:
        this.advance();
        return this.parseIf(token);
      case TokenType.While:
        return this.parseWhile();
      case TokenType.For:
        return this.parseFor();
      case TokenType.Break:
      case TokenType.Continue:
        return this.parseLoopControl();
      case TokenType.LeftBrace:
        return this.parseBlock('Se esperaba `{` para abrir el bloque.');
      case TokenType.Else:
        throw this.error('`sino` debe ir justo después del bloque de un `si`.', token.position);
      default:
        return this.parseExpressionStatement();
    }
  }

  // Analiza `var nombre: tipo = valor` o `constante NOMBRE = valor`
  private parseVarDeclaration(): VarDeclaration {
    const keyword = this.advance();
    const constant = keyword.type === TokenType.Const;
    const name = this.consume(
      TokenType.Identifier,
      `Después de \`${keyword.lexeme}\` va el nombre, por ejemplo: \`${keyword.lexeme} edad = 20\`.`,
    );
    const typeAnnotation = this.parseOptionalType();
    let initializer: Expression | null = null;
    if (this.match(TokenType.Equal)) {
      initializer = this.parseExpression();
    }
    else if (constant) {
      throw this.error(
        `La constante \`${name.lexeme}\` necesita un valor inicial, por ejemplo: \`constante ${name.lexeme} = 10\`.`,
        name.position,
      );
    }
    this.consumeStatementEnd();
    return {kind: 'VarDeclaration', name: name.lexeme, constant, typeAnnotation, initializer, position: keyword.position};
  }

  // Analiza `funcion nombre(parametros): tipo { ... }`
  private parseFunctionDeclaration(): FunctionDeclaration {
    const keyword = this.advance();
    const name = this.consume(
      TokenType.Identifier,
      'Después de `funcion` va el nombre de la función, por ejemplo: `funcion saludar() { }`.',
    );
    this.consume(TokenType.LeftParen, `Se esperaba \`(\` después del nombre \`${name.lexeme}\` para abrir los parámetros.`);
    const params = this.parseParameters();
    const returnType = this.parseOptionalType();
    const enclosingLoopDepth = this.loopDepth;
    this.functionDepth++;
    this.loopDepth = 0;
    try {
      const body = this.parseBlock(`Se esperaba \`{\` para abrir el cuerpo de la función \`${name.lexeme}\`.`);
      return {kind: 'FunctionDeclaration', name: name.lexeme, params, returnType, body, position: keyword.position};
    }
    finally {
      this.functionDepth--;
      this.loopDepth = enclosingLoopDepth;
    }
  }

  // Analiza la lista de parámetros hasta el paréntesis de cierre
  private parseParameters(): Parameter[] {
    const params: Parameter[] = [];
    const seen = new Set<string>();
    if (this.match(TokenType.RightParen)) {
      return params;
    }
    do {
      if (this.check(TokenType.RightParen)) {
        break;
      }
      const name = this.consume(TokenType.Identifier, `Se esperaba el nombre de un parámetro, pero se encontró ${describeToken(this.peek())}.`);
      if (seen.has(name.lexeme)) {
        this.report(`El parámetro \`${name.lexeme}\` está repetido.`, name.position);
      }
      seen.add(name.lexeme);
      params.push({name: name.lexeme, typeAnnotation: this.parseOptionalType(), position: name.position});
    } while (this.match(TokenType.Comma));
    this.consume(TokenType.RightParen, 'Falta `)` para cerrar los parámetros; sepáralos con comas.');
    return params;
  }

  // Analiza una anotación de tipo opcional `: tipo`
  private parseOptionalType(): TypeAnnotation | null {
    if (!this.match(TokenType.Colon)) {
      return null;
    }
    const name = this.consume(TokenType.Identifier, 'Después de `:` va el nombre de un tipo, por ejemplo: `entero`.');
    return {name: name.lexeme, position: name.position};
  }

  // Analiza `retornar` con o sin valor
  private parseReturn(): Statement {
    const keyword = this.advance();
    if (this.functionDepth === 0) {
      this.report('`retornar` solo se puede usar dentro de una función.', keyword.position);
    }
    let value: Expression | null = null;
    if (!this.isStatementEnd()) {
      value = this.parseExpression();
    }
    this.consumeStatementEnd();
    return {kind: 'Return', value, position: keyword.position};
  }

  // Analiza `si condicion { } sino si condicion { } sino { }`; el `si` ya fue consumido
  private parseIf(keyword: Token): If {
    const condition = this.parseCondition('si');
    const thenBranch = this.parseBlock('Se esperaba `{` después de la condición del `si`.');
    let elseBranch: Block | If | null = null;
    const beforeNewlines = this.current;
    this.skipNewlines();
    if (this.match(TokenType.Else)) {
      const elseIfKeyword = this.peek();
      if (this.match(TokenType.If)) {
        elseBranch = this.parseIf(elseIfKeyword);
      }
      else {
        elseBranch = this.parseBlock('Se esperaba `{` o `si` después de `sino`.');
      }
    }
    else {
      this.current = beforeNewlines;
    }
    return {kind: 'If', condition, thenBranch, elseBranch, position: keyword.position};
  }

  // Analiza `mientras condicion { }`
  private parseWhile(): Statement {
    const keyword = this.advance();
    const condition = this.parseCondition('mientras');
    const body = this.parseLoopBody('Se esperaba `{` después de la condición del `mientras`.');
    return {kind: 'While', condition, body, position: keyword.position};
  }

  // Analiza `para i desde inicio hasta fin paso salto { }`
  private parseFor(): Statement {
    const keyword = this.advance();
    const variable = this.consume(
      TokenType.Identifier,
      'Después de `para` va el nombre de la variable del ciclo, por ejemplo: `para i desde 1 hasta 10 { }`.',
    );
    this.consume(TokenType.From, `Se esperaba \`desde\` después de \`para ${variable.lexeme}\`.`);
    const start = this.parseExpression();
    this.consume(TokenType.To, 'Se esperaba `hasta` para indicar dónde termina el ciclo.');
    const end = this.parseExpression();
    let step: Expression | null = null;
    if (this.match(TokenType.Step)) {
      step = this.parseExpression();
    }
    const body = this.parseLoopBody('Se esperaba `{` para abrir el cuerpo del `para`.');
    return {kind: 'For', variable: variable.lexeme, start, end, step, body, position: keyword.position};
  }

  // Analiza el cuerpo de un ciclo, donde se permiten `romper` y `continuar`
  private parseLoopBody(message: string): Block {
    this.loopDepth++;
    try {
      return this.parseBlock(message);
    }
    finally {
      this.loopDepth--;
    }
  }

  // Analiza `romper` o `continuar`
  private parseLoopControl(): Statement {
    const keyword = this.advance();
    if (this.loopDepth === 0) {
      this.report(`\`${keyword.lexeme}\` solo se puede usar dentro de un ciclo \`mientras\` o \`para\`.`, keyword.position);
    }
    this.consumeStatementEnd();
    if (keyword.type === TokenType.Break) {
      return {kind: 'Break', position: keyword.position};
    }
    return {kind: 'Continue', position: keyword.position};
  }

  // Analiza la condición de un `si` o `mientras`, avisando si se usó `=` en vez de `==`
  private parseCondition(keyword: string): Expression {
    const condition = this.parseExpression();
    if (condition.kind === 'Assign') {
      this.report(
        `En la condición del \`${keyword}\` se compara con \`==\`; un solo \`=\` sirve para asignar.`,
        condition.position,
      );
    }
    return condition;
  }

  // Analiza un bloque entre llaves, recuperándose de los errores dentro de él
  private parseBlock(message: string): Block {
    const open = this.consume(TokenType.LeftBrace, message);
    const statements: Statement[] = [];
    this.skipSeparators();
    while (!this.check(TokenType.RightBrace) && !this.isAtEnd()) {
      this.parseStatementSafely(statements);
      this.skipSeparators();
    }
    if (this.isAtEnd()) {
      throw this.error('El bloque que se abre aquí no tiene `}` de cierre.', open.position);
    }
    this.advance();
    return {kind: 'Block', statements, position: open.position};
  }

  // Analiza una expresión usada como sentencia, por ejemplo una llamada o una asignación
  private parseExpressionStatement(): Statement {
    const expression = this.parseExpression();
    this.consumeStatementEnd();
    return {kind: 'ExpressionStatement', expression, position: expression.position};
  }

  // Analiza una expresión con el método de Pratt, respetando la precedencia mínima
  private parseExpression(minPrecedence: Precedence = Precedence.Assignment): Expression {
    let left = this.parsePrefix();
    while (true) {
      const precedence = precedenceOf(this.peek().type);
      if (precedence === Precedence.None || precedence < minPrecedence) {
        break;
      }
      left = this.parseInfix(left, precedence);
    }
    return left;
  }

  // Analiza lo que puede iniciar una expresión: valores, nombres, agrupaciones y operadores unarios
  private parsePrefix(): Expression {
    const token = this.peek();
    switch (token.type) {
      case TokenType.Number:
        this.advance();
        return {kind: 'NumberLiteral', value: token.literal as number, position: token.position};
      case TokenType.String:
        this.advance();
        return {kind: 'StringLiteral', value: token.literal as string, position: token.position};
      case TokenType.True:
      case TokenType.False:
        this.advance();
        return {kind: 'BooleanLiteral', value: token.type === TokenType.True, position: token.position};
      case TokenType.Null:
        this.advance();
        return {kind: 'NullLiteral', position: token.position};
      case TokenType.Identifier:
        this.advance();
        return {kind: 'Variable', name: token.lexeme, position: token.position};
      case TokenType.LeftParen:
        return this.parseGrouping();
      case TokenType.LeftBracket:
        return this.parseList();
      case TokenType.Minus:
        this.advance();
        return {kind: 'Unary', operator: '-', operand: this.parseExpression(Precedence.Unary), position: token.position};
      case TokenType.Not:
        this.advance();
        return {kind: 'Unary', operator: 'no', operand: this.parseExpression(Precedence.Not), position: token.position};
      default:
        throw this.error(this.missingValueMessage(token), token.position);
    }
  }

  // Explica qué falta cuando se esperaba un valor
  private missingValueMessage(token: Token): string {
    const previous = this.previous();
    if (previous !== null && (binaryOperators.has(previous.type) || previous.type === TokenType.Equal)) {
      return `Falta un valor después de \`${previous.lexeme}\`.`;
    }
    if (statementStarters.has(token.type)) {
      return `Se esperaba un valor, pero \`${token.lexeme}\` empieza una sentencia nueva.`;
    }
    return `Se esperaba un valor, pero se encontró ${describeToken(token)}.`;
  }

  // Analiza los operadores que van después de una expresión
  private parseInfix(left: Expression, precedence: Precedence): Expression {
    const operator = this.advance();
    switch (operator.type) {
      case TokenType.Equal:
        return this.parseAssignment(left, operator);
      case TokenType.And:
      case TokenType.Or:
        return {
          kind: 'Logical',
          operator: operator.lexeme as 'y' | 'o',
          left,
          right: this.parseExpression(precedence + 1),
          position: operator.position,
        };
      case TokenType.LeftParen:
        return {kind: 'Call', callee: left, args: this.parseArguments(), position: left.position};
      case TokenType.LeftBracket:
        return this.parseIndex(left, operator);
      default:
        return {
          kind: 'Binary',
          operator: binaryOperators.get(operator.type)!,
          left,
          right: this.parseExpression(precedence + 1),
          position: operator.position,
        };
    }
  }

  // Analiza una asignación, que agrupa de derecha a izquierda
  private parseAssignment(target: Expression, operator: Token): Expression {
    const value = this.parseExpression(Precedence.Assignment);
    if (target.kind !== 'Variable' && target.kind !== 'Index') {
      throw this.error('Solo se puede asignar a una variable o a una posición de una lista.', operator.position);
    }
    return {kind: 'Assign', target, value, position: operator.position};
  }

  // Analiza `(expresion)`
  private parseGrouping(): Expression {
    const open = this.advance();
    const expression = this.parseExpression();
    this.consumeClosing(TokenType.RightParen, ')', open);
    return expression;
  }

  // Analiza una lista literal `[a, b, c]`, admitiendo una coma final
  private parseList(): Expression {
    const open = this.advance();
    const elements: Expression[] = [];
    while (!this.check(TokenType.RightBracket) && !this.isAtEnd()) {
      elements.push(this.parseExpression());
      if (!this.match(TokenType.Comma)) {
        break;
      }
    }
    this.consumeClosing(TokenType.RightBracket, ']', open);
    return {kind: 'ListLiteral', elements, position: open.position};
  }

  // Analiza los argumentos de una llamada; el paréntesis de apertura ya fue consumido
  private parseArguments(): Expression[] {
    const open = this.previous()!;
    const args: Expression[] = [];
    while (!this.check(TokenType.RightParen) && !this.isAtEnd()) {
      args.push(this.parseExpression());
      if (!this.match(TokenType.Comma)) {
        break;
      }
    }
    this.consumeClosing(TokenType.RightParen, ')', open);
    return args;
  }

  // Analiza el acceso a una posición `lista[indice]`
  private parseIndex(target: Expression, open: Token): Expression {
    const index = this.parseExpression();
    this.consumeClosing(TokenType.RightBracket, ']', open);
    return {kind: 'Index', target, index, position: open.position};
  }

  // Exige el símbolo de cierre y, si falta, señala dónde se abrió
  private consumeClosing(type: TokenType, symbol: string, open: Token): void {
    if (this.match(type)) {
      return;
    }
    const found = this.peek();
    if (found.type === TokenType.EndOfFile) {
      throw this.error(`Falta \`${symbol}\` para cerrar el \`${open.lexeme}\` que se abre aquí.`, open.position);
    }
    throw this.error(
      `Se esperaba \`${symbol}\` para cerrar el \`${open.lexeme}\` de la línea ${open.position.line}, pero se encontró ${describeToken(found)}. ¿Falta una coma?`,
      found.position,
    );
  }

  // Exige que la sentencia termine en salto de línea, `;`, `}` o el final del archivo
  private consumeStatementEnd(): void {
    if (this.match(TokenType.Newline) || this.match(TokenType.Semicolon)) {
      return;
    }
    if (this.check(TokenType.RightBrace) || this.isAtEnd()) {
      return;
    }
    const extra = this.peek();
    throw this.error(
      `Sobra ${describeToken(extra)} después de la sentencia; cada sentencia va en su propia línea.`,
      extra.position,
    );
  }

  // Indica si el token actual termina la sentencia
  private isStatementEnd(): boolean {
    return statementSeparators.has(this.peek().type) || this.check(TokenType.RightBrace) || this.isAtEnd();
  }

  // Salta tokens hasta un punto seguro donde empieza la siguiente sentencia
  private synchronize(): void {
    while (!this.isAtEnd()) {
      const previous = this.previous();
      if (previous !== null && statementSeparators.has(previous.type)) {
        return;
      }
      if (statementStarters.has(this.peek().type) || this.check(TokenType.RightBrace)) {
        return;
      }
      this.advance();
    }
  }

  // Salta los saltos de línea y los `;` sobrantes
  private skipSeparators(): void {
    while (statementSeparators.has(this.peek().type)) {
      this.advance();
    }
  }

  // Salta solo los saltos de línea
  private skipNewlines(): void {
    while (this.check(TokenType.Newline)) {
      this.advance();
    }
  }

  // Consume el token esperado o detiene la sentencia con el mensaje indicado
  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) {
      return this.advance();
    }
    throw this.error(message, this.peek().position);
  }

  // Registra un error y devuelve la excepción que corta la sentencia
  private error(message: string, position: Position): ParseError {
    this.report(message, position);
    return new ParseError(message);
  }

  // Registra un error sin cortar el análisis
  private report(message: string, position: Position): void {
    this.diagnostics.push(createDiagnostic('parser', message, position));
  }

  // Consume el token actual solo si es del tipo indicado
  private match(type: TokenType): boolean {
    if (!this.check(type)) {
      return false;
    }
    this.advance();
    return true;
  }

  // Indica si el token actual es del tipo indicado
  private check(type: TokenType): boolean {
    return this.peek().type === type;
  }

  // Consume el token actual y lo devuelve
  private advance(): Token {
    const token = this.peek();
    if (!this.isAtEnd()) {
      this.current++;
    }
    return token;
  }

  // Devuelve el token actual sin consumirlo
  private peek(): Token {
    return this.tokens[this.current];
  }

  // Devuelve el último token consumido
  private previous(): Token | null {
    if (this.current === 0) {
      return null;
    }
    return this.tokens[this.current - 1];
  }

  // Indica si se llegó al final de los tokens
  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EndOfFile;
  }
}

// Convierte una lista de tokens en el árbol de sintaxis del programa
export const parseTokens = (tokens: Token[]): ParseResult => new Parser(tokens).parse();
