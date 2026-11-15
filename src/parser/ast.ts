import type {Position} from '../errors/diagnostic.js';

export type BinaryOperator = '+' | '-' | '*' | '/' | '%' | '==' | '!=' | '<' | '<=' | '>' | '>=';
export type LogicalOperator = 'y' | 'o';
export type UnaryOperator = '-' | 'no';

export interface TypeAnnotation {
  name: string;
  position: Position;
}

export interface NumberLiteral {
  kind: 'NumberLiteral';
  value: number;
  decimal: boolean;
  position: Position;
}

export interface StringLiteral {
  kind: 'StringLiteral';
  value: string;
  position: Position;
}

export interface BooleanLiteral {
  kind: 'BooleanLiteral';
  value: boolean;
  position: Position;
}

export interface NullLiteral {
  kind: 'NullLiteral';
  position: Position;
}

export interface ListLiteral {
  kind: 'ListLiteral';
  elements: Expression[];
  position: Position;
}

export interface Variable {
  kind: 'Variable';
  name: string;
  position: Position;
}

export interface Unary {
  kind: 'Unary';
  operator: UnaryOperator;
  operand: Expression;
  position: Position;
}

export interface Binary {
  kind: 'Binary';
  operator: BinaryOperator;
  left: Expression;
  right: Expression;
  position: Position;
}

export interface Logical {
  kind: 'Logical';
  operator: LogicalOperator;
  left: Expression;
  right: Expression;
  position: Position;
}

export interface Call {
  kind: 'Call';
  callee: Expression;
  args: Expression[];
  position: Position;
}

export interface Index {
  kind: 'Index';
  target: Expression;
  index: Expression;
  position: Position;
}

export interface Assign {
  kind: 'Assign';
  target: Variable | Index;
  value: Expression;
  position: Position;
}

export type Expression =
  | NumberLiteral
  | StringLiteral
  | BooleanLiteral
  | NullLiteral
  | ListLiteral
  | Variable
  | Unary
  | Binary
  | Logical
  | Call
  | Index
  | Assign;

export interface VarDeclaration {
  kind: 'VarDeclaration';
  name: string;
  constant: boolean;
  typeAnnotation: TypeAnnotation | null;
  initializer: Expression | null;
  position: Position;
}

export interface Parameter {
  name: string;
  typeAnnotation: TypeAnnotation | null;
  position: Position;
}

export interface FunctionDeclaration {
  kind: 'FunctionDeclaration';
  name: string;
  params: Parameter[];
  returnType: TypeAnnotation | null;
  body: Block;
  position: Position;
}

export interface Return {
  kind: 'Return';
  value: Expression | null;
  position: Position;
}

export interface If {
  kind: 'If';
  condition: Expression;
  thenBranch: Block;
  elseBranch: Block | If | null;
  position: Position;
}

export interface While {
  kind: 'While';
  condition: Expression;
  body: Block;
  position: Position;
}

export interface For {
  kind: 'For';
  variable: string;
  start: Expression;
  end: Expression;
  step: Expression | null;
  body: Block;
  position: Position;
}

export interface Break {
  kind: 'Break';
  position: Position;
}

export interface Continue {
  kind: 'Continue';
  position: Position;
}

export interface Block {
  kind: 'Block';
  statements: Statement[];
  position: Position;
}

export interface ExpressionStatement {
  kind: 'ExpressionStatement';
  expression: Expression;
  position: Position;
}

export type Statement =
  | VarDeclaration
  | FunctionDeclaration
  | Return
  | If
  | While
  | For
  | Break
  | Continue
  | Block
  | ExpressionStatement;

export interface Program {
  kind: 'Program';
  statements: Statement[];
}
