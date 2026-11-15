import {createDiagnostic, type Diagnostic, type Position} from '../errors/diagnostic.js';
import {arityMessage, readOnlyMessage, redeclarationMessage, undeclaredAssignmentMessage} from '../errors/messages.js';
import {withSuggestion} from '../errors/suggestions.js';
import type {
  Assign,
  Binary,
  BinaryOperator,
  Call,
  Expression,
  For,
  FunctionDeclaration,
  If,
  Index,
  Logical,
  Program,
  Statement,
  Unary,
  VarDeclaration,
  While,
} from '../parser/ast.js';
import {createBuiltins} from './builtins.js';
import {Environment, type Binding} from './environment.js';
import {RuntimeError} from './runtimeError.js';
import {describeType, isCallable, stringify, valuesEqual, type Callable, type UserFunction, type Value} from './values.js';

export interface InterpretOptions {
  write: (line: string) => void;
  maxSteps?: number;
  maxCallDepth?: number;
  random?: () => number;
}

export interface InterpretResult {
  diagnostics: Diagnostic[];
}

type Signal =
  | {kind: 'normal'}
  | {kind: 'break'}
  | {kind: 'continue'}
  | {kind: 'return'; value: Value};

const normalSignal: Signal = {kind: 'normal'};
const breakSignal: Signal = {kind: 'break'};
const continueSignal: Signal = {kind: 'continue'};

const defaultMaxSteps = 10_000_000;
const defaultMaxCallDepth = 400;

const arithmeticVerbs: Readonly<Record<string, string>> = {
  '+': 'sumar',
  '-': 'restar',
  '*': 'multiplicar',
  '/': 'dividir',
  '%': 'calcular el residuo entre',
};

class Interpreter {
  private readonly globals: Environment;
  private readonly maxSteps: number;
  private readonly maxCallDepth: number;
  private steps = 0;
  private callDepth = 0;
  private lastCallPosition: Position = {line: 1, column: 1};

  constructor(options: InterpretOptions) {
    const builtins = new Environment();
    let random = Math.random;
    if (options.random !== undefined) {
      random = options.random;
    }
    for (const builtin of createBuiltins({write: options.write, random})) {
      builtins.define(builtin.name, builtin, 'native');
    }
    this.globals = new Environment(builtins);
    this.maxSteps = options.maxSteps ?? defaultMaxSteps;
    this.maxCallDepth = options.maxCallDepth ?? defaultMaxCallDepth;
  }

  // Ejecuta el programa y convierte los errores de ejecución en diagnósticos
  run(program: Program): InterpretResult {
    try {
      this.executeStatements(program.statements, this.globals);
      return {diagnostics: []};
    }
    catch (error) {
      if (error instanceof RuntimeError) {
        return {diagnostics: [createDiagnostic('runtime', error.message, error.position)]};
      }
      // El motor de JavaScript se quedó sin pila antes de llegar al límite propio
      if (error instanceof RangeError) {
        return {diagnostics: [createDiagnostic('runtime', this.tooDeepMessage(), this.lastCallPosition)]};
      }
      throw error;
    }
  }

  // Ejecuta una lista de sentencias, declarando antes sus funciones para poder usarlas desde arriba
  private executeStatements(statements: Statement[], scope: Environment): Signal {
    for (const statement of statements) {
      if (statement.kind === 'FunctionDeclaration') {
        this.declareFunction(statement, scope);
      }
    }
    for (const statement of statements) {
      const signal = this.execute(statement, scope);
      if (signal.kind !== 'normal') {
        return signal;
      }
    }
    return normalSignal;
  }

  // Ejecuta una sentencia y avisa si debe cortarse el flujo
  private execute(statement: Statement, scope: Environment): Signal {
    switch (statement.kind) {
      case 'VarDeclaration':
        this.executeVarDeclaration(statement, scope);
        return normalSignal;
      case 'FunctionDeclaration':
        return normalSignal;
      case 'Return':
        if (statement.value === null) {
          return {kind: 'return', value: null};
        }
        return {kind: 'return', value: this.evaluate(statement.value, scope)};
      case 'If':
        return this.executeIf(statement, scope);
      case 'While':
        return this.executeWhile(statement, scope);
      case 'For':
        return this.executeFor(statement, scope);
      case 'Break':
        return breakSignal;
      case 'Continue':
        return continueSignal;
      case 'Block':
        return this.executeStatements(statement.statements, new Environment(scope));
      case 'ExpressionStatement':
        this.evaluate(statement.expression, scope);
        return normalSignal;
    }
  }

  // Declara una variable o constante con su valor inicial
  private executeVarDeclaration(statement: VarDeclaration, scope: Environment): void {
    let value: Value = null;
    if (statement.initializer !== null) {
      value = this.evaluate(statement.initializer, scope);
    }
    let kind: Binding['kind'] = 'variable';
    if (statement.constant) {
      kind = 'constant';
    }
    this.defineName(statement.name, value, kind, scope, statement.position);
  }

  // Registra una función en el ámbito donde se declaró, que queda como su clausura
  private declareFunction(declaration: FunctionDeclaration, scope: Environment): void {
    const fn: UserFunction = {kind: 'function', declaration, closure: scope};
    this.defineName(declaration.name, fn, 'function', scope, declaration.position);
  }

  // Declara un nombre nuevo, evitando repetirlo en el mismo bloque
  private defineName(name: string, value: Value, kind: Binding['kind'], scope: Environment, position: Position): void {
    if (!scope.define(name, value, kind)) {
      throw new RuntimeError(redeclarationMessage(name), position);
    }
  }

  // Ejecuta la rama del `si` que corresponda
  private executeIf(statement: If, scope: Environment): Signal {
    const condition = this.evaluate(statement.condition, scope);
    if (this.requireBoolean(condition, 'si', statement.condition.position)) {
      return this.executeStatements(statement.thenBranch.statements, new Environment(scope));
    }
    if (statement.elseBranch === null) {
      return normalSignal;
    }
    if (statement.elseBranch.kind === 'If') {
      return this.executeIf(statement.elseBranch, scope);
    }
    return this.executeStatements(statement.elseBranch.statements, new Environment(scope));
  }

  // Repite el cuerpo mientras la condición sea verdadera
  private executeWhile(statement: While, scope: Environment): Signal {
    while (true) {
      this.tick(statement.position);
      const condition = this.evaluate(statement.condition, scope);
      if (!this.requireBoolean(condition, 'mientras', statement.condition.position)) {
        return normalSignal;
      }
      const signal = this.executeStatements(statement.body.statements, new Environment(scope));
      if (signal.kind === 'break') {
        return normalSignal;
      }
      if (signal.kind === 'return') {
        return signal;
      }
    }
  }

  // Recorre los números del rango; sin `paso` avanza de uno en uno y para contar hacia abajo se usa un paso negativo
  private executeFor(statement: For, scope: Environment): Signal {
    const start = this.requireNumber(this.evaluate(statement.start, scope), '`desde`', statement.start.position);
    const end = this.requireNumber(this.evaluate(statement.end, scope), '`hasta`', statement.end.position);
    let step = 1;
    if (statement.step !== null) {
      step = this.requireNumber(this.evaluate(statement.step, scope), '`paso`', statement.step.position);
      if (step === 0) {
        throw new RuntimeError('El `paso` no puede ser cero: el ciclo nunca terminaría.', statement.step.position);
      }
    }
    // Se calcula cada valor desde el inicio para no acumular errores de los decimales
    for (let iteration = 0; ; iteration++) {
      const current = start + iteration * step;
      if ((step > 0 && current > end) || (step < 0 && current < end)) {
        return normalSignal;
      }
      this.tick(statement.position);
      const loopScope = new Environment(scope);
      this.defineName(statement.variable, current, 'loop', loopScope, statement.position);
      const signal = this.executeStatements(statement.body.statements, new Environment(loopScope));
      if (signal.kind === 'break') {
        return normalSignal;
      }
      if (signal.kind === 'return') {
        return signal;
      }
    }
  }

  // Calcula el valor de una expresión
  private evaluate(expression: Expression, scope: Environment): Value {
    switch (expression.kind) {
      case 'NumberLiteral':
      case 'StringLiteral':
      case 'BooleanLiteral':
        return expression.value;
      case 'NullLiteral':
        return null;
      case 'ListLiteral':
        return expression.elements.map((element) => this.evaluate(element, scope));
      case 'Variable':
        return this.resolve(expression.name, scope, expression.position).value;
      case 'Assign':
        return this.evaluateAssign(expression, scope);
      case 'Unary':
        return this.evaluateUnary(expression, scope);
      case 'Logical':
        return this.evaluateLogical(expression, scope);
      case 'Binary':
        return this.evaluateBinary(expression, scope);
      case 'Call':
        return this.evaluateCall(expression, scope);
      case 'Index':
        return this.evaluateIndex(expression, scope);
    }
  }

  // Busca un nombre y, si no existe, sugiere el más parecido
  private resolve(name: string, scope: Environment, position: Position): Binding {
    const binding = scope.lookup(name);
    if (binding === undefined) {
      const message = withSuggestion(`\`${name}\` no existe.`, name, scope.visibleNames());
      throw new RuntimeError(message, position);
    }
    return binding;
  }

  // Asigna un valor a una variable o a una posición de una lista
  private evaluateAssign(expression: Assign, scope: Environment): Value {
    const value = this.evaluate(expression.value, scope);
    const target = expression.target;
    if (target.kind === 'Index') {
      const list = this.evaluate(target.target, scope);
      const index = this.evaluate(target.index, scope);
      if (typeof list === 'string') {
        throw new RuntimeError('Los textos no se pueden modificar por posición; arma un texto nuevo.', target.position);
      }
      if (!Array.isArray(list)) {
        throw new RuntimeError(`Solo se puede asignar por posición en una lista, pero aquí hay ${describeType(list)}.`, target.position);
      }
      list[this.checkIndex(index, list.length, target.position)] = value;
      return value;
    }
    const binding = scope.lookup(target.name);
    if (binding === undefined) {
      const message = withSuggestion(
        undeclaredAssignmentMessage(target.name),
        target.name,
        scope.visibleNames(),
      );
      throw new RuntimeError(message, target.position);
    }
    if (binding.kind !== 'variable') {
      throw new RuntimeError(readOnlyMessage(binding.kind, target.name), target.position);
    }
    binding.value = value;
    return value;
  }

  // Aplica el menos o la negación `no`
  private evaluateUnary(expression: Unary, scope: Environment): Value {
    const operand = this.evaluate(expression.operand, scope);
    if (expression.operator === 'no') {
      if (typeof operand !== 'boolean') {
        throw new RuntimeError(
          `\`no\` solo se puede usar con verdadero o falso, pero aquí hay ${describeType(operand)}.`,
          expression.position,
        );
      }
      return !operand;
    }
    if (typeof operand !== 'number') {
      throw new RuntimeError(
        `El signo \`-\` solo se puede usar con números, pero aquí hay ${describeType(operand)}.`,
        expression.position,
      );
    }
    return -operand;
  }

  // Evalúa `y` y `o`, sin calcular la derecha si la izquierda ya decide el resultado
  private evaluateLogical(expression: Logical, scope: Environment): Value {
    const left = this.evaluate(expression.left, scope);
    this.requireLogicalOperand(left, expression, 'a la izquierda');
    if (expression.operator === 'y' && !left) {
      return false;
    }
    if (expression.operator === 'o' && left) {
      return true;
    }
    const right = this.evaluate(expression.right, scope);
    this.requireLogicalOperand(right, expression, 'a la derecha');
    return right;
  }

  // Exige que un lado de `y` u `o` sea verdadero o falso
  private requireLogicalOperand(value: Value, expression: Logical, side: string): void {
    if (typeof value !== 'boolean') {
      throw new RuntimeError(
        `\`${expression.operator}\` une condiciones verdaderas o falsas, pero ${side} hay ${describeType(value)}.`,
        expression.position,
      );
    }
  }

  // Evalúa operaciones aritméticas, comparaciones e igualdades
  private evaluateBinary(expression: Binary, scope: Environment): Value {
    const left = this.evaluate(expression.left, scope);
    const right = this.evaluate(expression.right, scope);
    const operator = expression.operator;
    if (operator === '==') {
      return valuesEqual(left, right);
    }
    if (operator === '!=') {
      return !valuesEqual(left, right);
    }
    if (operator === '<' || operator === '<=' || operator === '>' || operator === '>=') {
      return this.compare(operator, left, right, expression.position);
    }
    if (operator === '+') {
      return this.add(left, right, expression.position);
    }
    return this.arithmetic(operator, left, right, expression.position);
  }

  // Suma números, une textos o une listas
  private add(left: Value, right: Value, position: Position): Value {
    if (typeof left === 'number' && typeof right === 'number') {
      return left + right;
    }
    if (typeof left === 'string' || typeof right === 'string') {
      return stringify(left) + stringify(right);
    }
    if (Array.isArray(left) && Array.isArray(right)) {
      return [...left, ...right];
    }
    throw new RuntimeError(`No se puede sumar ${describeType(left)} y ${describeType(right)}.`, position);
  }

  // Resta, multiplica, divide o calcula el residuo de dos números
  private arithmetic(operator: BinaryOperator, left: Value, right: Value, position: Position): Value {
    if (typeof left !== 'number' || typeof right !== 'number') {
      throw new RuntimeError(
        `No se puede ${arithmeticVerbs[operator]} ${describeType(left)} y ${describeType(right)}; se necesitan dos números.`,
        position,
      );
    }
    if ((operator === '/' || operator === '%') && right === 0) {
      throw new RuntimeError('No se puede dividir entre cero.', position);
    }
    switch (operator) {
      case '-':
        return left - right;
      case '*':
        return left * right;
      case '/':
        return left / right;
      default:
        return left % right;
    }
  }

  // Compara dos números o dos textos
  private compare(operator: BinaryOperator, left: Value, right: Value, position: Position): boolean {
    const bothNumbers = typeof left === 'number' && typeof right === 'number';
    const bothStrings = typeof left === 'string' && typeof right === 'string';
    if (!bothNumbers && !bothStrings) {
      throw new RuntimeError(
        `Con \`${operator}\` solo se comparan dos números o dos textos, pero aquí hay ${describeType(left)} y ${describeType(right)}.`,
        position,
      );
    }
    const a = left as number | string;
    const b = right as number | string;
    switch (operator) {
      case '<':
        return a < b;
      case '<=':
        return a <= b;
      case '>':
        return a > b;
      default:
        return a >= b;
    }
  }

  // Llama a una función del usuario o propia del lenguaje
  private evaluateCall(expression: Call, scope: Environment): Value {
    const callee = this.evaluate(expression.callee, scope);
    if (!isCallable(callee)) {
      if (expression.callee.kind === 'Variable') {
        throw new RuntimeError(
          `\`${expression.callee.name}\` no es una función, es ${describeType(callee)}.`,
          expression.position,
        );
      }
      throw new RuntimeError(`Esto no es una función, es ${describeType(callee)}.`, expression.position);
    }
    const args = expression.args.map((arg) => this.evaluate(arg, scope));
    this.checkArity(callee, args.length, expression.position);
    if (callee.kind === 'native') {
      return callee.call(args, expression.position);
    }
    return this.callUserFunction(callee, args, expression.position);
  }

  // Verifica que la cantidad de argumentos coincida con la de parámetros
  private checkArity(callee: Callable, count: number, position: Position): void {
    let name = '';
    let expected: number | null = null;
    if (callee.kind === 'native') {
      name = callee.name;
      expected = callee.arity;
    }
    else {
      name = callee.declaration.name;
      expected = callee.declaration.params.length;
    }
    if (expected !== null && expected !== count) {
      throw new RuntimeError(arityMessage(name, expected, count), position);
    }
  }

  // Ejecuta el cuerpo de una función con sus parámetros en un ámbito nuevo
  private callUserFunction(fn: UserFunction, args: Value[], position: Position): Value {
    this.tick(position);
    this.lastCallPosition = position;
    if (this.callDepth >= this.maxCallDepth) {
      throw new RuntimeError(this.tooDeepMessage(fn.declaration.name), position);
    }
    this.callDepth++;
    try {
      const callScope = new Environment(fn.closure);
      fn.declaration.params.forEach((param, index) => {
        callScope.define(param.name, args[index], 'variable');
      });
      const signal = this.executeStatements(fn.declaration.body.statements, callScope);
      if (signal.kind === 'return') {
        return signal.value;
      }
      return null;
    }
    finally {
      this.callDepth--;
    }
  }

  // Mensaje cuando hay demasiadas llamadas anidadas
  private tooDeepMessage(name?: string): string {
    let subject = 'una función';
    if (name !== undefined) {
      subject = `\`${name}\``;
    }
    return `Hay demasiadas llamadas anidadas a ${subject}. ¿Se llama a sí misma sin una condición que la detenga?`;
  }

  // Lee el elemento de una lista o el carácter de un texto en una posición
  private evaluateIndex(expression: Index, scope: Environment): Value {
    const target = this.evaluate(expression.target, scope);
    const index = this.evaluate(expression.index, scope);
    if (!Array.isArray(target) && typeof target !== 'string') {
      throw new RuntimeError(
        `Solo se puede acceder por posición a listas y textos, pero aquí hay ${describeType(target)}.`,
        expression.position,
      );
    }
    return target[this.checkIndex(index, target.length, expression.position)];
  }

  // Verifica que la posición sea un entero dentro del rango y la devuelve
  private checkIndex(index: Value, length: number, position: Position): number {
    if (typeof index !== 'number' || !Number.isInteger(index)) {
      throw new RuntimeError(
        `La posición debe ser un número entero, pero aquí es ${describeType(index)}${this.showNumber(index)}.`,
        position,
      );
    }
    if (length === 0) {
      throw new RuntimeError(`La posición ${index} no existe: no hay ningún elemento.`, position);
    }
    if (index < 0 || index >= length) {
      throw new RuntimeError(
        `La posición ${index} no existe: hay ${length} elementos, en las posiciones 0 a ${length - 1}.`,
        position,
      );
    }
    return index;
  }

  // Muestra el número entre paréntesis cuando ayuda a entender el error
  private showNumber(value: Value): string {
    if (typeof value === 'number') {
      return ` (${value})`;
    }
    return '';
  }

  // Exige que la condición sea verdadero o falso
  private requireBoolean(value: Value, keyword: string, position: Position): boolean {
    if (typeof value !== 'boolean') {
      throw new RuntimeError(
        `La condición del \`${keyword}\` debe ser verdadero o falso, pero es ${describeType(value)}.`,
        position,
      );
    }
    return value;
  }

  // Exige que el valor sea un número
  private requireNumber(value: Value, label: string, position: Position): number {
    if (typeof value !== 'number') {
      throw new RuntimeError(`El valor de ${label} debe ser un número, pero es ${describeType(value)}.`, position);
    }
    return value;
  }

  // Cuenta un paso de ejecución y corta el programa si nunca termina
  private tick(position: Position): void {
    this.steps++;
    if (this.steps > this.maxSteps) {
      throw new RuntimeError(
        `El programa superó el límite de ${this.maxSteps} pasos. ¿Hay un ciclo que nunca termina?`,
        position,
      );
    }
  }
}

// Ejecuta un programa ya analizado
export const interpret = (program: Program, options: InterpretOptions): InterpretResult => {
  return new Interpreter(options).run(program);
};
