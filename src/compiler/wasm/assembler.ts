import {isMemoryOp, isSimpleOp, type Instruction, type ValueType} from './instructions.js';

export interface AssemblerContext {
  local: (name: string) => number;
  global: (name: string) => number;
  call: (name: string) => Instruction;
  text: (value: string) => number;
}

interface StringToken {
  text: string;
}

type Token = string | StringToken;
type Expression = Token | Expression[];

const labelPrefix = '$';
const offsetPrefix = 'offset=';
const valueTypes = new Set(['i32', 'i64', 'f64', 'externref']);
const blockOps = new Set(['block', 'loop']);

// Error al escribir el runtime: indica un problema del compilador, no del programa del usuario
class AssemblerError extends Error {}

// Resuelve el carácter que sigue a una barra invertida dentro de un texto
const escapedChar = (char: string): string => {
  if (char === 'n') {
    return '\n';
  }
  return char;
};

// Corta el texto en paréntesis, palabras y textos entre comillas, ignorando los comentarios `;;`
const tokenize = (source: string): Token[] => {
  const tokens: Token[] = [];
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (char === ';' && source[index + 1] === ';') {
      while (index < source.length && source[index] !== '\n') {
        index++;
      }
    }
    else if (char === '(' || char === ')') {
      tokens.push(char);
      index++;
    }
    else if (char === '"') {
      let text = '';
      index++;
      while (source[index] !== '"') {
        if (source[index] === '\\') {
          index++;
          text += escapedChar(source[index]);
        }
        else {
          text += source[index];
        }
        index++;
      }
      tokens.push({text});
      index++;
    }
    else if (/\s/.test(char)) {
      index++;
    }
    else {
      let atom = '';
      while (index < source.length && !/[\s()]/.test(source[index])) {
        atom += source[index];
        index++;
      }
      tokens.push(atom);
    }
  }
  return tokens;
};

// Arma la lista anidada de expresiones a partir de los tokens
const parseExpressions = (tokens: Token[]): Expression[] => {
  const stack: Expression[][] = [[]];
  for (const token of tokens) {
    if (token === '(') {
      stack.push([]);
    }
    else if (token === ')') {
      const finished = stack.pop()!;
      stack.at(-1)!.push(finished);
    }
    else {
      stack.at(-1)!.push(token);
    }
  }
  if (stack.length !== 1) {
    throw new AssemblerError('Paréntesis desbalanceados en el runtime');
  }
  return stack[0];
};

// Devuelve el texto de un token que debe ser una palabra
const atomOf = (expression: Expression | undefined): string => {
  if (typeof expression !== 'string') {
    throw new AssemblerError(`Se esperaba una palabra y se encontró ${JSON.stringify(expression)}`);
  }
  return expression;
};

// Indica si la expresión es `(result tipo)`
const isResult = (expression: Expression | undefined): expression is Expression[] => {
  return Array.isArray(expression) && expression[0] === 'result';
};

// Indica si la expresión es una sección `(then ...)` o `(else ...)`
const isSection = (expression: Expression, name: string): expression is Expression[] => {
  return Array.isArray(expression) && expression[0] === name;
};

class Assembler {
  private readonly context: AssemblerContext;
  private readonly output: Instruction[] = [];
  private readonly labels: (string | null)[] = [];

  constructor(context: AssemblerContext) {
    this.context = context;
  }

  // Ensambla una lista de expresiones en orden
  assemble(expressions: Expression[]): Instruction[] {
    for (const expression of expressions) {
      this.emitExpression(expression);
    }
    return this.output;
  }

  // Ensambla una expresión anidada: primero sus operandos y después su instrucción
  private emitExpression(expression: Expression): void {
    if (!Array.isArray(expression)) {
      throw new AssemblerError(`Instrucción fuera de paréntesis: ${JSON.stringify(expression)}`);
    }
    const op = atomOf(expression[0]);
    const rest = expression.slice(1);
    if (blockOps.has(op)) {
      this.emitBlock(op as 'block' | 'loop', rest);
      return;
    }
    if (op === 'if') {
      this.emitIf(rest);
      return;
    }
    const immediates: string[] = [];
    const children: Expression[] = [];
    for (const item of rest) {
      if (typeof item === 'string') {
        immediates.push(item);
      }
      else if (Array.isArray(item)) {
        children.push(item);
      }
      else {
        immediates.push(`"${item.text}`);
      }
    }
    for (const child of children) {
      this.emitExpression(child);
    }
    this.output.push(this.instruction(op, immediates, rest));
  }

  // Ensambla `block` o `loop` con su etiqueta y su tipo de resultado opcionales
  private emitBlock(op: 'block' | 'loop', rest: Expression[]): void {
    const {label, result, body} = this.blockHeader(rest);
    this.output.push({op, result});
    this.labels.push(label);
    for (const expression of body) {
      this.emitExpression(expression);
    }
    this.labels.pop();
    this.output.push({op: 'end'});
  }

  // Ensambla `if`: la condición, la rama `then` y la rama `else` opcional
  private emitIf(rest: Expression[]): void {
    const {label, result, body} = this.blockHeader(rest);
    const thenSection = body.find((item) => isSection(item, 'then')) as Expression[] | undefined;
    const elseSection = body.find((item) => isSection(item, 'else')) as Expression[] | undefined;
    if (thenSection === undefined) {
      throw new AssemblerError('`if` sin `then` en el runtime');
    }
    for (const condition of body.filter((item) => item !== thenSection && item !== elseSection)) {
      this.emitExpression(condition);
    }
    this.output.push({op: 'if', result});
    this.labels.push(label);
    for (const expression of thenSection.slice(1)) {
      this.emitExpression(expression);
    }
    if (elseSection !== undefined) {
      this.output.push({op: 'else'});
      for (const expression of elseSection.slice(1)) {
        this.emitExpression(expression);
      }
    }
    this.labels.pop();
    this.output.push({op: 'end'});
  }

  // Separa la etiqueta y el tipo de resultado del resto del bloque
  private blockHeader(rest: Expression[]): {label: string | null; result: ValueType | null; body: Expression[]} {
    let label: string | null = null;
    let result: ValueType | null = null;
    let index = 0;
    if (typeof rest[index] === 'string' && (rest[index] as string).startsWith(labelPrefix)) {
      label = rest[index] as string;
      index++;
    }
    if (isResult(rest[index])) {
      const type = atomOf((rest[index] as Expression[])[1]);
      if (!valueTypes.has(type)) {
        throw new AssemblerError(`Tipo desconocido: ${type}`);
      }
      result = type as ValueType;
      index++;
    }
    return {label, result, body: rest.slice(index)};
  }

  // Calcula cuántos bloques hay que saltar para llegar a la etiqueta
  private depthOf(target: string): number {
    if (!target.startsWith(labelPrefix)) {
      return Number(target);
    }
    const index = this.labels.lastIndexOf(target);
    if (index === -1) {
      throw new AssemblerError(`Etiqueta desconocida: ${target}`);
    }
    return this.labels.length - 1 - index;
  }

  // Convierte el nombre de la instrucción y sus inmediatos en una instrucción
  private instruction(op: string, immediates: string[], rest: Expression[]): Instruction {
    switch (op) {
      case 'local.get':
      case 'local.set':
      case 'local.tee':
        return {op, index: this.context.local(immediates[0])};
      case 'global.get':
      case 'global.set':
        return {op, index: this.context.global(immediates[0])};
      case 'call':
        return this.context.call(immediates[0]);
      case 'br':
      case 'br_if':
        return {op, depth: this.depthOf(immediates[0])};
      case 'i32.const':
        return {op, value: Number(immediates[0])};
      case 'i64.const':
        return {op, value: BigInt(immediates[0])};
      case 'f64.const':
        return {op, value: Number(immediates[0].replace(/^inf$/, 'Infinity'))};
      case 'text.const': {
        const literal = rest.find((item) => typeof item === 'object' && !Array.isArray(item)) as StringToken;
        return {op: 'i32.const', value: this.context.text(literal.text)};
      }
      case 'memory.size':
      case 'memory.grow':
      case 'memory.copy':
        return {op};
      default:
        if (isMemoryOp(op)) {
          const offset = immediates.find((item) => item.startsWith(offsetPrefix));
          return {op, offset: Number(offset?.slice(offsetPrefix.length) ?? 0)};
        }
        if (isSimpleOp(op)) {
          return {op};
        }
        throw new AssemblerError(`Instrucción desconocida en el runtime: ${op}`);
    }
  }
}

// Ensambla el cuerpo de una función escrito en el formato de texto anidado de WebAssembly
export const assembleBody = (source: string, context: AssemblerContext): Instruction[] => {
  return new Assembler(context).assemble(parseExpressions(tokenize(source)));
};
