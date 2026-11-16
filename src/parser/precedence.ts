import {TokenType} from '../lexer/token.js';
import type {BinaryOperator} from './ast.js';

export enum Precedence {
  None = 0,
  Assignment = 1,
  Or = 2,
  And = 3,
  Not = 4,
  Equality = 5,
  Comparison = 6,
  Term = 7,
  Factor = 8,
  Unary = 9,
  Call = 10,
}

const infixPrecedences: ReadonlyMap<TokenType, Precedence> = new Map([
  [TokenType.Equal, Precedence.Assignment],
  [TokenType.Or, Precedence.Or],
  [TokenType.And, Precedence.And],
  [TokenType.EqualEqual, Precedence.Equality],
  [TokenType.BangEqual, Precedence.Equality],
  [TokenType.Less, Precedence.Comparison],
  [TokenType.LessEqual, Precedence.Comparison],
  [TokenType.Greater, Precedence.Comparison],
  [TokenType.GreaterEqual, Precedence.Comparison],
  [TokenType.Plus, Precedence.Term],
  [TokenType.Minus, Precedence.Term],
  [TokenType.Star, Precedence.Factor],
  [TokenType.Slash, Precedence.Factor],
  [TokenType.Percent, Precedence.Factor],
  [TokenType.LeftParen, Precedence.Call],
  [TokenType.LeftBracket, Precedence.Call],
  [TokenType.Dot, Precedence.Call],
]);

export const binaryOperators: ReadonlyMap<TokenType, BinaryOperator> = new Map<TokenType, BinaryOperator>([
  [TokenType.Plus, '+'],
  [TokenType.Minus, '-'],
  [TokenType.Star, '*'],
  [TokenType.Slash, '/'],
  [TokenType.Percent, '%'],
  [TokenType.EqualEqual, '=='],
  [TokenType.BangEqual, '!='],
  [TokenType.Less, '<'],
  [TokenType.LessEqual, '<='],
  [TokenType.Greater, '>'],
  [TokenType.GreaterEqual, '>='],
]);

// Devuelve la precedencia del token como operador infijo, o None si no lo es
export const precedenceOf = (type: TokenType): Precedence => {
  const precedence = infixPrecedences.get(type);
  if (precedence === undefined) {
    return Precedence.None;
  }
  return precedence;
};
