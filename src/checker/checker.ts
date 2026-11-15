import {createDiagnostic, type Diagnostic, type Position} from '../errors/diagnostic.js';
import {arityMessage, readOnlyMessage, redeclarationMessage, undeclaredAssignmentMessage} from '../errors/messages.js';
import {withSuggestion} from '../errors/suggestions.js';
import type {
  Assign,
  Binary,
  Call,
  Expression,
  For,
  FunctionDeclaration,
  If,
  Index,
  Logical,
  Program,
  Return,
  Statement,
  TypeAnnotation,
  Unary,
  VarDeclaration,
} from '../parser/ast.js';
import {builtinSignatures, type BuiltinSignature} from './builtinSignatures.js';
import {Scope, type SymbolInfo, type SymbolKind} from './scope.js';
import {
  booleanType,
  commonType,
  decimalType,
  describeType,
  integerType,
  isAssignable,
  isBooleanLike,
  isNumeric,
  isTextLike,
  isUnknown,
  listOf,
  listTypeName,
  nullType,
  numericResult,
  textType,
  typeNames,
  typeToString,
  unknownType,
  type FunctionType,
  type Type,
} from './types.js';

export interface CheckResult {
  diagnostics: Diagnostic[];
}

interface FunctionContext {
  name: string;
  returnType: Type | null;
}

const builtinPosition: Position = {line: 0, column: 0};

const arithmeticVerbs: Readonly<Record<string, string>> = {
  '-': 'restar',
  '*': 'multiplicar',
  '/': 'dividir',
  '%': 'calcular el residuo entre',
};

const initialValueExamples: Readonly<Record<string, string>> = {
  integer: '0',
  decimal: '0.0',
  text: '""',
  boolean: 'falso',
  list: '[]',
};

// Ordena los diagnósticos por línea y luego por columna
const comparePositions = (first: Diagnostic, second: Diagnostic): number => {
  if (first.position.line !== second.position.line) {
    return first.position.line - second.position.line;
  }
  return first.position.column - second.position.column;
};

// Indica si el bloque contiene un `romper` que sale de su propio ciclo
const containsBreak = (statements: Statement[]): boolean => {
  return statements.some((statement) => {
    if (statement.kind === 'Break') {
      return true;
    }
    if (statement.kind === 'Block') {
      return containsBreak(statement.statements);
    }
    if (statement.kind === 'If') {
      return containsBreakInIf(statement);
    }
    return false;
  });
};

// Indica si alguna rama del `si` contiene un `romper`
const containsBreakInIf = (statement: If): boolean => {
  if (containsBreak(statement.thenBranch.statements)) {
    return true;
  }
  if (statement.elseBranch === null) {
    return false;
  }
  if (statement.elseBranch.kind === 'If') {
    return containsBreakInIf(statement.elseBranch);
  }
  return containsBreak(statement.elseBranch.statements);
};

// Indica si la sentencia siempre termina en `retornar`, sin importar el camino
const statementAlwaysReturns = (statement: Statement): boolean => {
  switch (statement.kind) {
    case 'Return':
      return true;
    case 'Block':
      return alwaysReturns(statement.statements);
    case 'If':
      if (statement.elseBranch === null || !alwaysReturns(statement.thenBranch.statements)) {
        return false;
      }
      return statementAlwaysReturns(statement.elseBranch);
    case 'While':
      // `mientras verdadero` sin `romper` solo puede salir retornando
      return statement.condition.kind === 'BooleanLiteral' && statement.condition.value && !containsBreak(statement.body.statements);
    default:
      return false;
  }
};

// Indica si una lista de sentencias siempre llega a un `retornar`
const alwaysReturns = (statements: Statement[]): boolean => statements.some(statementAlwaysReturns);

class Checker {
  private readonly diagnostics: Diagnostic[] = [];
  private readonly globals: Scope;
  private functionContext: FunctionContext | null = null;

  constructor() {
    const builtins = new Scope();
    for (const signature of builtinSignatures.values()) {
      builtins.define(this.nativeSymbol(signature));
    }
    this.globals = new Scope(builtins);
  }

  // Revisa el programa completo y devuelve los errores encontrados antes de ejecutar
  check(program: Program): CheckResult {
    this.checkStatements(program.statements, this.globals);
    // Los cuerpos de las funciones se revisan al final de su bloque; se ordena para leer los errores de arriba hacia abajo
    const sorted = [...this.diagnostics].sort(comparePositions);
    return {diagnostics: sorted};
  }

  // Crea el símbolo de una función propia del lenguaje
  private nativeSymbol(signature: BuiltinSignature): SymbolInfo {
    return {
      name: signature.name,
      type: unknownType,
      kind: 'native',
      inferred: false,
      builtin: signature,
      position: builtinPosition,
    };
  }

  // Revisa un bloque: declara antes sus funciones y revisa sus cuerpos al final, cuando ya existen todas sus variables
  private checkStatements(statements: Statement[], scope: Scope): void {
    const functions: FunctionDeclaration[] = [];
    for (const statement of statements) {
      if (statement.kind === 'FunctionDeclaration') {
        this.declareFunction(statement, scope);
        functions.push(statement);
      }
    }
    for (const statement of statements) {
      this.checkStatement(statement, scope);
    }
    for (const declaration of functions) {
      this.checkFunctionBody(declaration, scope);
    }
  }

  // Revisa una sentencia según su clase
  private checkStatement(statement: Statement, scope: Scope): void {
    switch (statement.kind) {
      case 'VarDeclaration':
        this.checkVarDeclaration(statement, scope);
        return;
      case 'FunctionDeclaration':
        return;
      case 'Return':
        this.checkReturn(statement, scope);
        return;
      case 'If':
        this.checkIf(statement, scope);
        return;
      case 'While':
        this.requireCondition(this.typeOf(statement.condition, scope), 'mientras', statement.condition.position);
        this.checkStatements(statement.body.statements, new Scope(scope));
        return;
      case 'For':
        this.checkFor(statement, scope);
        return;
      case 'Break':
      case 'Continue':
        return;
      case 'Block':
        this.checkStatements(statement.statements, new Scope(scope));
        return;
      case 'ExpressionStatement':
        this.typeOf(statement.expression, scope);
        return;
    }
  }

  // Revisa una declaración y fija el tipo de la variable: el anotado o el de su valor inicial
  private checkVarDeclaration(statement: VarDeclaration, scope: Scope): void {
    let annotatedType: Type | null = null;
    if (statement.typeAnnotation !== null) {
      annotatedType = this.resolveAnnotation(statement.typeAnnotation);
    }
    let initializerType: Type | null = null;
    if (statement.initializer !== null) {
      initializerType = this.typeOfExpected(statement.initializer, annotatedType, scope);
    }
    let declaredType: Type = unknownType;
    let inferred = false;
    if (annotatedType !== null) {
      declaredType = annotatedType;
      if (initializerType === null) {
        this.reportMissingInitializer(statement, declaredType);
      }
      else if (!isAssignable(declaredType, initializerType)) {
        this.report(
          `\`${statement.name}\` es de tipo ${typeToString(declaredType)}; no se le puede asignar ${describeType(initializerType)}.${this.conversionHint(declaredType, initializerType)}`,
          statement.initializer!.position,
        );
      }
    }
    else if (initializerType !== null && initializerType.kind !== 'null') {
      declaredType = initializerType;
      inferred = true;
    }
    let kind: SymbolKind = 'variable';
    if (statement.constant) {
      kind = 'constant';
    }
    this.defineSymbol(scope, {
      name: statement.name,
      type: declaredType,
      kind,
      inferred,
      builtin: null,
      position: statement.position,
    });
  }

  // Tipo de una expresión cuando se conoce el tipo esperado; en listas escritas revisa cada elemento
  private typeOfExpected(expression: Expression, expected: Type | null, scope: Scope): Type {
    if (expected === null || expected.kind !== 'list' || expression.kind !== 'ListLiteral') {
      return this.typeOf(expression, scope);
    }
    for (const element of expression.elements) {
      const elementType = this.typeOfExpected(element, expected.element, scope);
      if (!isAssignable(expected.element, elementType)) {
        this.report(
          `Esta lista es de ${typeToString(expected.element)}; no se le puede guardar ${describeType(elementType)}.`,
          element.position,
        );
      }
    }
    return expected;
  }

  // Avisa que una variable con tipo necesita un valor inicial
  private reportMissingInitializer(statement: VarDeclaration, declaredType: Type): void {
    let example = initialValueExamples[declaredType.kind];
    if (example === undefined) {
      example = '...';
    }
    this.report(
      `La variable \`${statement.name}\` es de tipo ${typeToString(declaredType)} y necesita un valor inicial, por ejemplo: \`var ${statement.name}: ${typeToString(declaredType)} = ${example}\`.`,
      statement.position,
    );
  }

  // Sugiere la función de conversión cuando el valor tiene otro tipo
  private conversionHint(target: Type, source: Type): string {
    if (target.kind === 'integer' && source.kind === 'decimal') {
      return ' Para quitar los decimales usa `redondear()`.';
    }
    if (target.kind === 'text' && source.kind !== 'text') {
      return ' Para convertirlo usa `texto()`.';
    }
    if (target.kind === 'integer' && source.kind === 'text') {
      return ' Para convertirlo usa `redondear(numero(...))`.';
    }
    if (target.kind === 'decimal' && source.kind === 'text') {
      return ' Para convertirlo usa `numero()`.';
    }
    return '';
  }

  // Convierte una anotación escrita en el tipo que representa
  private resolveAnnotation(annotation: TypeAnnotation): Type {
    if (annotation.name === listTypeName) {
      if (annotation.element === null) {
        return listOf(unknownType);
      }
      return listOf(this.resolveAnnotation(annotation.element));
    }
    const type = typeNames.get(annotation.name);
    if (type === undefined) {
      const message = withSuggestion(
        `El tipo \`${annotation.name}\` no existe; los tipos son \`entero\`, \`decimal\`, \`texto\`, \`logico\` y \`lista de ...\`.`,
        annotation.name,
        [...typeNames.keys(), listTypeName],
      );
      this.report(message, annotation.position);
      return unknownType;
    }
    return type;
  }

  // Registra el tipo de una función para poder llamarla desde cualquier parte del bloque
  private declareFunction(declaration: FunctionDeclaration, scope: Scope): void {
    this.defineSymbol(scope, {
      name: declaration.name,
      type: this.functionType(declaration),
      kind: 'function',
      inferred: false,
      builtin: null,
      position: declaration.position,
    });
  }

  // Arma el tipo de una función a partir de sus anotaciones; lo no anotado queda desconocido
  private functionType(declaration: FunctionDeclaration): FunctionType {
    const params = declaration.params.map((param) => this.annotationOrUnknown(param.typeAnnotation));
    return {
      kind: 'function',
      name: declaration.name,
      params,
      paramNames: declaration.params.map((param) => param.name),
      returns: this.annotationOrUnknown(declaration.returnType),
    };
  }

  // Tipo de una anotación opcional
  private annotationOrUnknown(annotation: TypeAnnotation | null): Type {
    if (annotation === null) {
      return unknownType;
    }
    return this.resolveAnnotation(annotation);
  }

  // Revisa el cuerpo de una función con sus parámetros, dentro del ámbito donde se declaró
  private checkFunctionBody(declaration: FunctionDeclaration, scope: Scope): void {
    const symbol = scope.lookup(declaration.name);
    if (symbol === undefined || symbol.type.kind !== 'function') {
      return;
    }
    const type = symbol.type;
    const bodyScope = new Scope(scope);
    declaration.params.forEach((param, index) => {
      bodyScope.define({
        name: param.name,
        type: type.params[index],
        kind: 'variable',
        inferred: false,
        builtin: null,
        position: param.position,
      });
    });
    const enclosingContext = this.functionContext;
    let returnType: Type | null = null;
    if (declaration.returnType !== null) {
      returnType = type.returns;
    }
    this.functionContext = {name: declaration.name, returnType};
    this.checkStatements(declaration.body.statements, bodyScope);
    this.functionContext = enclosingContext;
    if (returnType !== null && !alwaysReturns(declaration.body.statements)) {
      this.report(
        `La función \`${declaration.name}\` debe retornar ${describeType(returnType)}, pero puede terminar sin llegar a \`retornar\`. Revisa que cada camino, incluido el \`sino\`, retorne un valor.`,
        declaration.position,
      );
    }
  }

  // Revisa que el valor retornado coincida con el tipo de retorno de la función
  private checkReturn(statement: Return, scope: Scope): void {
    let valueType: Type | null = null;
    if (statement.value !== null) {
      valueType = this.typeOf(statement.value, scope);
    }
    const context = this.functionContext;
    if (context === null || context.returnType === null) {
      return;
    }
    if (valueType === null) {
      this.report(
        `La función \`${context.name}\` debe retornar ${describeType(context.returnType)}; falta el valor después de \`retornar\`.`,
        statement.position,
      );
      return;
    }
    if (!isAssignable(context.returnType, valueType)) {
      this.report(
        `La función \`${context.name}\` debe retornar ${describeType(context.returnType)}, pero aquí retorna ${describeType(valueType)}.${this.conversionHint(context.returnType, valueType)}`,
        statement.value!.position,
      );
    }
  }

  // Revisa la condición y las ramas de un `si`
  private checkIf(statement: If, scope: Scope): void {
    this.requireCondition(this.typeOf(statement.condition, scope), 'si', statement.condition.position);
    this.checkStatements(statement.thenBranch.statements, new Scope(scope));
    if (statement.elseBranch === null) {
      return;
    }
    if (statement.elseBranch.kind === 'If') {
      this.checkIf(statement.elseBranch, scope);
    }
    else {
      this.checkStatements(statement.elseBranch.statements, new Scope(scope));
    }
  }

  // Exige que la condición sea verdadero o falso
  private requireCondition(type: Type, keyword: string, position: Position): void {
    if (!isBooleanLike(type)) {
      this.report(`La condición del \`${keyword}\` debe ser verdadero o falso, pero es ${describeType(type)}.`, position);
    }
  }

  // Revisa los límites del `para` y fija el tipo de su variable
  private checkFor(statement: For, scope: Scope): void {
    const boundTypes = [
      this.requireNumericBound(statement.start, 'desde', scope),
      this.requireNumericBound(statement.end, 'hasta', scope),
    ];
    if (statement.step !== null) {
      boundTypes.push(this.requireNumericBound(statement.step, 'paso', scope));
      if (this.isZeroLiteral(statement.step)) {
        this.report('El `paso` no puede ser cero: el ciclo nunca terminaría.', statement.step.position);
      }
    }
    const variableType = boundTypes.reduce(numericResult);
    const loopScope = new Scope(scope);
    loopScope.define({
      name: statement.variable,
      type: variableType,
      kind: 'loop',
      inferred: false,
      builtin: null,
      position: statement.position,
    });
    this.checkStatements(statement.body.statements, new Scope(loopScope));
  }

  // Exige que un límite del `para` sea un número
  private requireNumericBound(expression: Expression, label: string, scope: Scope): Type {
    const type = this.typeOf(expression, scope);
    if (!isNumeric(type)) {
      this.report(`El valor de \`${label}\` debe ser un número, pero es ${describeType(type)}.`, expression.position);
      return unknownType;
    }
    return type;
  }

  // Indica si la expresión es el número cero escrito directamente
  private isZeroLiteral(expression: Expression): boolean {
    if (expression.kind === 'NumberLiteral') {
      return expression.value === 0;
    }
    if (expression.kind === 'Unary' && expression.operator === '-') {
      return this.isZeroLiteral(expression.operand);
    }
    return false;
  }

  // Calcula el tipo de una expresión y registra los errores que encuentre
  private typeOf(expression: Expression, scope: Scope): Type {
    switch (expression.kind) {
      case 'NumberLiteral':
        if (expression.decimal || !Number.isInteger(expression.value)) {
          return decimalType;
        }
        return integerType;
      case 'StringLiteral':
        return textType;
      case 'BooleanLiteral':
        return booleanType;
      case 'NullLiteral':
        return nullType;
      case 'ListLiteral':
        return this.typeOfList(expression.elements, scope);
      case 'Variable':
        return this.typeOfVariable(expression.name, scope, expression.position);
      case 'Assign':
        return this.typeOfAssign(expression, scope);
      case 'Unary':
        return this.typeOfUnary(expression, scope);
      case 'Logical':
        return this.typeOfLogical(expression, scope);
      case 'Binary':
        return this.typeOfBinary(expression, scope);
      case 'Call':
        return this.typeOfCall(expression, scope);
      case 'Index':
        return this.typeOfIndex(expression, scope);
    }
  }

  // Tipo de una lista literal: el común a sus elementos
  private typeOfList(elements: Expression[], scope: Scope): Type {
    const types = elements.map((element) => this.typeOf(element, scope));
    if (types.length === 0) {
      return listOf(unknownType);
    }
    return listOf(types.reduce(commonType));
  }

  // Tipo de un nombre; si no existe sugiere el más parecido
  private typeOfVariable(name: string, scope: Scope, position: Position): Type {
    const symbol = scope.lookup(name);
    if (symbol === undefined) {
      this.report(withSuggestion(`\`${name}\` no existe.`, name, scope.visibleNames()), position);
      return unknownType;
    }
    return symbol.type;
  }

  // Revisa una asignación a una variable o a una posición de una lista
  private typeOfAssign(expression: Assign, scope: Scope): Type {
    const valueType = this.typeOf(expression.value, scope);
    const target = expression.target;
    if (target.kind === 'Index') {
      this.checkIndexAssign(target, valueType, scope);
      return valueType;
    }
    const symbol = scope.lookup(target.name);
    if (symbol === undefined) {
      this.report(withSuggestion(undeclaredAssignmentMessage(target.name), target.name, scope.visibleNames()), target.position);
      return valueType;
    }
    if (symbol.kind !== 'variable') {
      this.report(readOnlyMessage(symbol.kind, target.name), target.position);
      return valueType;
    }
    if (!isAssignable(symbol.type, valueType)) {
      this.report(this.assignMismatchMessage(symbol, valueType), expression.value.position);
    }
    return valueType;
  }

  // Explica por qué el valor no cabe en la variable, aclarando si el tipo vino de su valor inicial
  private assignMismatchMessage(symbol: SymbolInfo, valueType: Type): string {
    const base = `\`${symbol.name}\` es de tipo ${typeToString(symbol.type)}; no se le puede asignar ${describeType(valueType)}.`;
    if (symbol.inferred && symbol.type.kind === 'integer' && valueType.kind === 'decimal') {
      return `${base} Tomó el tipo entero de su valor inicial; para guardar decimales, empieza con \`0.0\` o declárala con \`: decimal\`.`;
    }
    if (symbol.inferred) {
      return `${base} Tomó ese tipo de su valor inicial.${this.conversionHint(symbol.type, valueType)}`;
    }
    return `${base}${this.conversionHint(symbol.type, valueType)}`;
  }

  // Revisa la asignación a `lista[posicion]`
  private checkIndexAssign(target: Index, valueType: Type, scope: Scope): void {
    const containerType = this.typeOf(target.target, scope);
    this.requireIndex(this.typeOf(target.index, scope), target.index.position);
    if (containerType.kind === 'text') {
      this.report('Los textos no se pueden modificar por posición; arma un texto nuevo.', target.position);
      return;
    }
    if (containerType.kind !== 'list') {
      if (!isUnknown(containerType)) {
        this.report(`Solo se puede asignar por posición en una lista, pero aquí hay ${describeType(containerType)}.`, target.position);
      }
      return;
    }
    if (!isAssignable(containerType.element, valueType)) {
      this.report(
        `Esta lista es de ${typeToString(containerType.element)}; no se le puede guardar ${describeType(valueType)}.`,
        target.position,
      );
    }
  }

  // Tipo del menos o de la negación `no`
  private typeOfUnary(expression: Unary, scope: Scope): Type {
    const operand = this.typeOf(expression.operand, scope);
    if (expression.operator === 'no') {
      if (!isBooleanLike(operand)) {
        this.report(`\`no\` solo se puede usar con verdadero o falso, pero aquí hay ${describeType(operand)}.`, expression.position);
      }
      return booleanType;
    }
    if (!isNumeric(operand)) {
      this.report(`El signo \`-\` solo se puede usar con números, pero aquí hay ${describeType(operand)}.`, expression.position);
      return unknownType;
    }
    return operand;
  }

  // Tipo de `y` y `o`: ambos lados deben ser verdadero o falso
  private typeOfLogical(expression: Logical, scope: Scope): Type {
    const sides: [Type, string][] = [
      [this.typeOf(expression.left, scope), 'a la izquierda'],
      [this.typeOf(expression.right, scope), 'a la derecha'],
    ];
    for (const [type, side] of sides) {
      if (!isBooleanLike(type)) {
        this.report(
          `\`${expression.operator}\` une condiciones verdaderas o falsas, pero ${side} hay ${describeType(type)}.`,
          expression.position,
        );
      }
    }
    return booleanType;
  }

  // Tipo de una operación aritmética, comparación o igualdad
  private typeOfBinary(expression: Binary, scope: Scope): Type {
    const left = this.typeOf(expression.left, scope);
    const right = this.typeOf(expression.right, scope);
    switch (expression.operator) {
      case '==':
      case '!=':
        this.checkEquality(left, right, expression.position);
        return booleanType;
      case '<':
      case '<=':
      case '>':
      case '>=':
        this.checkComparison(expression.operator, left, right, expression.position);
        return booleanType;
      case '+':
        return this.typeOfAddition(left, right, expression.position);
      case '/':
        this.checkArithmetic(expression.operator, left, right, expression.position);
        return decimalType;
      default:
        if (!this.checkArithmetic(expression.operator, left, right, expression.position)) {
          return unknownType;
        }
        return numericResult(left, right);
    }
  }

  // Avisa cuando se comparan tipos que nunca pueden ser iguales
  private checkEquality(left: Type, right: Type, position: Position): void {
    if (isUnknown(left) || isUnknown(right) || left.kind === 'null' || right.kind === 'null') {
      return;
    }
    if (isNumeric(left) && isNumeric(right)) {
      return;
    }
    if (left.kind !== right.kind) {
      this.report(
        `Comparar ${describeType(left)} con ${describeType(right)} siempre da falso. ¿Falta convertir con \`numero()\` o \`texto()\`?`,
        position,
      );
    }
  }

  // Exige dos números o dos textos para comparar con `<`, `>` y similares
  private checkComparison(operator: string, left: Type, right: Type, position: Position): void {
    const numbers = isNumeric(left) && isNumeric(right);
    const texts = isTextLike(left) && isTextLike(right);
    if (!numbers && !texts) {
      this.report(
        `Con \`${operator}\` solo se comparan dos números o dos textos, pero aquí hay ${describeType(left)} y ${describeType(right)}.`,
        position,
      );
    }
  }

  // Tipo de una suma: números, unión de textos o unión de listas
  private typeOfAddition(left: Type, right: Type, position: Position): Type {
    if (left.kind === 'text' || right.kind === 'text') {
      return textType;
    }
    if (isNumeric(left) && isNumeric(right)) {
      return numericResult(left, right);
    }
    if (left.kind === 'list' && right.kind === 'list') {
      return listOf(commonType(left.element, right.element));
    }
    if (isUnknown(left) || isUnknown(right)) {
      return unknownType;
    }
    this.report(`No se puede sumar ${describeType(left)} y ${describeType(right)}.`, position);
    return unknownType;
  }

  // Exige dos números para restar, multiplicar, dividir o calcular el residuo
  private checkArithmetic(operator: string, left: Type, right: Type, position: Position): boolean {
    if (isNumeric(left) && isNumeric(right)) {
      return true;
    }
    this.report(
      `No se puede ${arithmeticVerbs[operator]} ${describeType(left)} y ${describeType(right)}; se necesitan dos números.`,
      position,
    );
    return false;
  }

  // Revisa una llamada: que sea una función, la cantidad de valores y sus tipos
  private typeOfCall(expression: Call, scope: Scope): Type {
    const argTypes = expression.args.map((arg) => this.typeOf(arg, scope));
    if (expression.callee.kind === 'Variable') {
      const symbol = scope.lookup(expression.callee.name);
      if (symbol !== undefined && symbol.builtin !== null) {
        return this.checkBuiltinCall(symbol.builtin, expression, argTypes);
      }
    }
    const calleeType = this.typeOf(expression.callee, scope);
    if (isUnknown(calleeType)) {
      return unknownType;
    }
    if (calleeType.kind !== 'function') {
      let subject = 'Esto';
      if (expression.callee.kind === 'Variable') {
        subject = `\`${expression.callee.name}\``;
      }
      this.report(`${subject} no es una función, es ${describeType(calleeType)}.`, expression.position);
      return unknownType;
    }
    if (calleeType.params.length !== argTypes.length) {
      this.report(arityMessage(calleeType.name, calleeType.params.length, argTypes.length), expression.position);
      return calleeType.returns;
    }
    calleeType.params.forEach((paramType, index) => {
      if (!isAssignable(paramType, argTypes[index])) {
        this.report(
          `El parámetro \`${calleeType.paramNames[index]}\` de \`${calleeType.name}\` espera ${describeType(paramType)}, pero recibió ${describeType(argTypes[index])}.`,
          expression.args[index].position,
        );
      }
    });
    return calleeType.returns;
  }

  // Revisa una llamada a una función propia con su firma
  private checkBuiltinCall(signature: BuiltinSignature, expression: Call, argTypes: Type[]): Type {
    if (signature.arity !== null && signature.arity !== argTypes.length) {
      this.report(arityMessage(signature.name, signature.arity, argTypes.length), expression.position);
      return unknownType;
    }
    return signature.check(argTypes, (index, message) => {
      this.report(message, expression.args[index].position);
    });
  }

  // Tipo de `lista[posicion]` o `texto[posicion]`
  private typeOfIndex(expression: Index, scope: Scope): Type {
    const containerType = this.typeOf(expression.target, scope);
    this.requireIndex(this.typeOf(expression.index, scope), expression.index.position);
    if (containerType.kind === 'list') {
      return containerType.element;
    }
    if (containerType.kind === 'text') {
      return textType;
    }
    if (!isUnknown(containerType)) {
      this.report(
        `Solo se puede acceder por posición a listas y textos, pero aquí hay ${describeType(containerType)}.`,
        expression.position,
      );
    }
    return unknownType;
  }

  // Exige que la posición sea un entero
  private requireIndex(type: Type, position: Position): void {
    if (type.kind !== 'integer' && !isUnknown(type)) {
      this.report(`La posición debe ser un entero, pero aquí es ${describeType(type)}.`, position);
    }
  }

  // Declara un símbolo y avisa si el nombre ya existe en el mismo bloque
  private defineSymbol(scope: Scope, symbol: SymbolInfo): void {
    if (!scope.define(symbol)) {
      this.report(redeclarationMessage(symbol.name), symbol.position);
    }
  }

  // Registra un error semántico
  private report(message: string, position: Position): void {
    this.diagnostics.push(createDiagnostic('semantic', message, position));
  }
}

// Revisa nombres y tipos de un programa ya analizado, sin ejecutarlo
export const checkProgram = (program: Program): CheckResult => new Checker().check(program);
