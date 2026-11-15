import type {Expression} from './ast.js';

// Escribe una expresión en notación prefija con paréntesis, para ver cómo quedó agrupada
export const printExpression = (expression: Expression): string => {
  switch (expression.kind) {
    case 'NumberLiteral':
      return String(expression.value);
    case 'StringLiteral':
      return JSON.stringify(expression.value);
    case 'BooleanLiteral':
      if (expression.value) {
        return 'verdadero';
      }
      return 'falso';
    case 'NullLiteral':
      return 'nulo';
    case 'Variable':
      return expression.name;
    case 'ListLiteral':
      return `[${expression.elements.map(printExpression).join(' ')}]`;
    case 'DictLiteral':
      return `{${expression.entries.map((entry) => `${printExpression(entry.key)}: ${printExpression(entry.value)}`).join(' ')}}`;
    case 'Unary':
      return `(${expression.operator} ${printExpression(expression.operand)})`;
    case 'Binary':
    case 'Logical':
      return `(${expression.operator} ${printExpression(expression.left)} ${printExpression(expression.right)})`;
    case 'Call':
      return `(llamar ${[expression.callee, ...expression.args].map(printExpression).join(' ')})`;
    case 'Index':
      return `(posicion ${printExpression(expression.target)} ${printExpression(expression.index)})`;
    case 'Assign':
      return `(= ${printExpression(expression.target)} ${printExpression(expression.value)})`;
  }
};
