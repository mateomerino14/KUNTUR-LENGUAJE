import type {Position} from '../errors/diagnostic.js';

export enum TokenType {
  Number = 'Number',
  String = 'String',
  Identifier = 'Identifier',

  Var = 'Var',
  Const = 'Const',
  Function = 'Function',
  Return = 'Return',
  If = 'If',
  Else = 'Else',
  While = 'While',
  For = 'For',
  From = 'From',
  To = 'To',
  Step = 'Step',
  Break = 'Break',
  Continue = 'Continue',
  True = 'True',
  False = 'False',
  Null = 'Null',
  And = 'And',
  Or = 'Or',
  Not = 'Not',

  Plus = 'Plus',
  Minus = 'Minus',
  Star = 'Star',
  Slash = 'Slash',
  Percent = 'Percent',
  Equal = 'Equal',
  EqualEqual = 'EqualEqual',
  BangEqual = 'BangEqual',
  Less = 'Less',
  LessEqual = 'LessEqual',
  Greater = 'Greater',
  GreaterEqual = 'GreaterEqual',
  LeftParen = 'LeftParen',
  RightParen = 'RightParen',
  LeftBrace = 'LeftBrace',
  RightBrace = 'RightBrace',
  LeftBracket = 'LeftBracket',
  RightBracket = 'RightBracket',
  Comma = 'Comma',
  Dot = 'Dot',
  Colon = 'Colon',
  Semicolon = 'Semicolon',

  Newline = 'Newline',
  EndOfFile = 'EndOfFile',
}

export interface Token {
  type: TokenType;
  lexeme: string;
  literal: number | string | null;
  position: Position;
}

export const keywords: ReadonlyMap<string, TokenType> = new Map([
  ['var', TokenType.Var],
  ['constante', TokenType.Const],
  ['funcion', TokenType.Function],
  ['función', TokenType.Function],
  ['retornar', TokenType.Return],
  ['si', TokenType.If],
  ['sino', TokenType.Else],
  ['mientras', TokenType.While],
  ['para', TokenType.For],
  ['desde', TokenType.From],
  ['hasta', TokenType.To],
  ['paso', TokenType.Step],
  ['romper', TokenType.Break],
  ['continuar', TokenType.Continue],
  ['verdadero', TokenType.True],
  ['falso', TokenType.False],
  ['nulo', TokenType.Null],
  ['y', TokenType.And],
  ['o', TokenType.Or],
  ['no', TokenType.Not],
]);

// Tokens tras los cuales un salto de línea termina la sentencia
export const statementEnders: ReadonlySet<TokenType> = new Set([
  TokenType.Number,
  TokenType.String,
  TokenType.Identifier,
  TokenType.True,
  TokenType.False,
  TokenType.Null,
  TokenType.Return,
  TokenType.Break,
  TokenType.Continue,
  TokenType.RightParen,
  TokenType.RightBracket,
  TokenType.RightBrace,
]);

// Describe un token para los mensajes de error, mostrando lo que escribió el usuario
export const describeToken = (token: Token): string => {
  if (token.type === TokenType.EndOfFile) {
    return 'el final del archivo';
  }
  if (token.type === TokenType.Newline) {
    return 'un salto de línea';
  }
  return `\`${token.lexeme}\``;
};
