import {TokenType} from '../../../../../src/index.js';

const keywordTypes = new Set<TokenType>([
  TokenType.Var, TokenType.Const, TokenType.Function, TokenType.Return, TokenType.If, TokenType.Else,
  TokenType.While, TokenType.For, TokenType.From, TokenType.To, TokenType.Step, TokenType.Break,
  TokenType.Continue, TokenType.And, TokenType.Or, TokenType.Not,
]);

const operatorTypes = new Set<TokenType>([
  TokenType.Plus, TokenType.Minus, TokenType.Star, TokenType.Slash, TokenType.Percent, TokenType.Equal,
  TokenType.EqualEqual, TokenType.BangEqual, TokenType.Less, TokenType.LessEqual, TokenType.Greater, TokenType.GreaterEqual,
]);

const fixedLabels: Partial<Record<TokenType, string>> = {
  [TokenType.Number]: 'número',
  [TokenType.String]: 'texto',
  [TokenType.Identifier]: 'nombre',
  [TokenType.True]: 'valor lógico',
  [TokenType.False]: 'valor lógico',
  [TokenType.Null]: 'nulo',
  [TokenType.Newline]: 'fin de sentencia',
  [TokenType.EndOfFile]: 'fin del archivo',
};

// Nombre en español de la clase de token, como se explica en clase
export const tokenLabel = (type: TokenType): string => {
  const fixed = fixedLabels[type];
  if (fixed !== undefined) {
    return fixed;
  }
  if (keywordTypes.has(type)) {
    return 'palabra clave';
  }
  if (operatorTypes.has(type)) {
    return 'operador';
  }
  return 'signo';
};

// Texto del token para mostrarlo en la tabla, con los invisibles escritos
export const tokenText = (lexeme: string, type: TokenType): string => {
  if (type === TokenType.Newline) {
    return '⏎';
  }
  if (type === TokenType.EndOfFile) {
    return '';
  }
  return lexeme;
};
