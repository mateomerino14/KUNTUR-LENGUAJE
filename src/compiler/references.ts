import type {Expression, If, Program, Statement} from '../parser/ast.js';

// Agrega a la lista los nombres de variables que lee o asigna la expresión
const collectFromExpression = (expression: Expression, names: Set<string>): void => {
  switch (expression.kind) {
    case 'Variable':
      names.add(expression.name);
      return;
    case 'ListLiteral':
      expression.elements.forEach((element) => collectFromExpression(element, names));
      return;
    case 'Assign':
      collectFromExpression(expression.target, names);
      collectFromExpression(expression.value, names);
      return;
    case 'Unary':
      collectFromExpression(expression.operand, names);
      return;
    case 'Binary':
    case 'Logical':
      collectFromExpression(expression.left, names);
      collectFromExpression(expression.right, names);
      return;
    case 'Call':
      collectFromExpression(expression.callee, names);
      expression.args.forEach((arg) => collectFromExpression(arg, names));
      return;
    case 'Index':
      collectFromExpression(expression.target, names);
      collectFromExpression(expression.index, names);
      return;
    default:
      return;
  }
};

// Agrega los nombres usados en las ramas de un `si`
const collectFromIf = (statement: If, names: Set<string>): void => {
  collectFromExpression(statement.condition, names);
  collectFromStatements(statement.thenBranch.statements, names);
  if (statement.elseBranch === null) {
    return;
  }
  if (statement.elseBranch.kind === 'If') {
    collectFromIf(statement.elseBranch, names);
  }
  else {
    collectFromStatements(statement.elseBranch.statements, names);
  }
};

// Agrega los nombres usados en una lista de sentencias
const collectFromStatements = (statements: Statement[], names: Set<string>): void => {
  for (const statement of statements) {
    switch (statement.kind) {
      case 'VarDeclaration':
        if (statement.initializer !== null) {
          collectFromExpression(statement.initializer, names);
        }
        break;
      case 'FunctionDeclaration':
        collectFromStatements(statement.body.statements, names);
        break;
      case 'Return':
        if (statement.value !== null) {
          collectFromExpression(statement.value, names);
        }
        break;
      case 'If':
        collectFromIf(statement, names);
        break;
      case 'While':
        collectFromExpression(statement.condition, names);
        collectFromStatements(statement.body.statements, names);
        break;
      case 'For':
        [statement.start, statement.end, statement.step].forEach((bound) => {
          if (bound !== null) {
            collectFromExpression(bound, names);
          }
        });
        collectFromStatements(statement.body.statements, names);
        break;
      case 'ForEach':
        collectFromExpression(statement.iterable, names);
        collectFromStatements(statement.body.statements, names);
        break;
      case 'Block':
        collectFromStatements(statement.statements, names);
        break;
      case 'ExpressionStatement':
        collectFromExpression(statement.expression, names);
        break;
      default:
        break;
    }
  }
};

// Reúne los nombres que usan las funciones del nivel superior, para saber qué variables globales pueden leer antes de declararse
export const namesUsedInFunctions = (program: Program): Set<string> => {
  const names = new Set<string>();
  for (const statement of program.statements) {
    if (statement.kind === 'FunctionDeclaration') {
      collectFromStatements(statement.body.statements, names);
    }
  }
  return names;
};
