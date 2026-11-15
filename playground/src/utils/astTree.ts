import {
  typeToString,
  type Expression,
  type Position,
  type Program,
  type Statement,
  type Type,
  type TypeAnnotation,
  type TypeInfo,
} from '../../../src/index.js';

export interface DisplayNode {
  id: string;
  role: string | null;
  label: string;
  detail: string | null;
  typeLabel: string | null;
  position: Position | null;
  children: DisplayNode[];
}

const programPosition: Position = {line: 1, column: 1};

// Escribe una anotación de tipo como en el código
const annotationText = (annotation: TypeAnnotation | null): string => {
  if (annotation === null) {
    return '';
  }
  if (annotation.element === null) {
    return `: ${annotation.name}`;
  }
  return `: ${annotation.name} de${annotationText(annotation.element).slice(1)}`;
};

// Palabra con la que empieza la declaración
const declarationKeyword = (constant: boolean): string => {
  if (constant) {
    return 'constante';
  }
  return 'var';
};

// Nombre del tipo para mostrarlo, o null si no se conoce
const typeLabelOf = (type: Type | undefined): string | null => {
  if (type === undefined || type.kind === 'unknown') {
    return null;
  }
  return typeToString(type);
};

// Valor lógico escrito como en Kuntur
const booleanText = (value: boolean): string => {
  if (value) {
    return 'verdadero';
  }
  return 'falso';
};

class TreeBuilder {
  private readonly types: TypeInfo | null;
  private nextId = 0;

  constructor(types: TypeInfo | null) {
    this.types = types;
  }

  // Crea un nodo con un identificador único
  node(role: string | null, label: string, detail: string | null, position: Position | null, children: DisplayNode[], typeLabel: string | null = null): DisplayNode {
    this.nextId++;
    return {id: `nodo-${this.nextId}`, role, label, detail, typeLabel, position, children};
  }

  // Convierte el programa completo
  program(program: Program): DisplayNode {
    return this.node(null, 'Programa', null, programPosition, program.statements.map((statement) => this.statement(null, statement)));
  }

  // Convierte una lista de sentencias en un bloque
  block(role: string, statements: Statement[], position: Position): DisplayNode {
    return this.node(role, 'Bloque', null, position, statements.map((statement) => this.statement(null, statement)));
  }

  // Convierte una sentencia según su clase
  statement(role: string | null, statement: Statement): DisplayNode {
    switch (statement.kind) {
      case 'VarDeclaration': {
        const detail = `${declarationKeyword(statement.constant)} ${statement.name}${annotationText(statement.typeAnnotation)}`;
        const typeLabel = typeLabelOf(this.types?.declarations.get(statement));
        return this.node(role, 'Declaración', detail, statement.position, this.optionalExpression('valor inicial', statement.initializer), typeLabel);
      }
      case 'FunctionDeclaration': {
        const params = statement.params.map((param) => `${param.name}${annotationText(param.typeAnnotation)}`).join(', ');
        return this.node(role, 'Función', `${statement.name}(${params})${annotationText(statement.returnType)}`, statement.position, [
          this.block('cuerpo', statement.body.statements, statement.body.position),
        ]);
      }
      case 'Return':
        return this.node(role, 'Retornar', null, statement.position, this.optionalExpression('valor', statement.value));
      case 'If': {
        const children = [this.expression('condición', statement.condition), this.block('entonces', statement.thenBranch.statements, statement.thenBranch.position)];
        if (statement.elseBranch !== null && statement.elseBranch.kind === 'If') {
          children.push(this.statement('sino', statement.elseBranch));
        }
        else if (statement.elseBranch !== null) {
          children.push(this.block('sino', statement.elseBranch.statements, statement.elseBranch.position));
        }
        return this.node(role, 'Si', null, statement.position, children);
      }
      case 'While':
        return this.node(role, 'Mientras', null, statement.position, [
          this.expression('condición', statement.condition),
          this.block('cuerpo', statement.body.statements, statement.body.position),
        ]);
      case 'For': {
        const children = [this.expression('desde', statement.start), this.expression('hasta', statement.end)];
        if (statement.step !== null) {
          children.push(this.expression('paso', statement.step));
        }
        children.push(this.block('cuerpo', statement.body.statements, statement.body.position));
        return this.node(role, 'Para', statement.variable, statement.position, children);
      }
      case 'ForEach':
        return this.node(role, 'Para cada', statement.variable, statement.position, [
          this.expression('recorre', statement.iterable),
          this.block('cuerpo', statement.body.statements, statement.body.position),
        ]);
      case 'RecordDeclaration':
        return this.node(
          role,
          'Registro',
          `${statement.name}(${statement.fields.map((field) => `${field.name}${annotationText(field.typeAnnotation)}`).join(', ')})`,
          statement.position,
          [],
        );
      case 'Break':
        return this.node(role, 'Romper', null, statement.position, []);
      case 'Continue':
        return this.node(role, 'Continuar', null, statement.position, []);
      case 'Block':
        return this.block(role ?? 'bloque', statement.statements, statement.position);
      case 'ExpressionStatement':
        return this.expression(role, statement.expression);
    }
  }

  // Convierte una expresión que puede faltar en una lista de cero o un hijo
  optionalExpression(role: string, expression: Expression | null): DisplayNode[] {
    if (expression === null) {
      return [];
    }
    return [this.expression(role, expression)];
  }

  // Convierte una expresión e incluye el tipo que dedujo el análisis semántico
  expression(role: string | null, expression: Expression): DisplayNode {
    const typeLabel = typeLabelOf(this.types?.expressions.get(expression));
    const make = (label: string, detail: string | null, children: DisplayNode[]) => this.node(role, label, detail, expression.position, children, typeLabel);
    switch (expression.kind) {
      case 'NumberLiteral':
        return make('Número', String(expression.value), []);
      case 'StringLiteral':
        return make('Texto', JSON.stringify(expression.value), []);
      case 'BooleanLiteral':
        return make('Lógico', booleanText(expression.value), []);
      case 'NullLiteral':
        return make('Nulo', null, []);
      case 'ListLiteral':
        return make('Lista', null, expression.elements.map((element, index) => this.expression(`elemento ${index}`, element)));
      case 'Field':
        return make('Campo', expression.name, [this.expression('registro', expression.target)]);
      case 'DictLiteral':
        return make('Diccionario', null, expression.entries.flatMap((entry, index) => [
          this.expression(`clave ${index}`, entry.key),
          this.expression(`valor ${index}`, entry.value),
        ]));
      case 'Variable':
        return make('Nombre', expression.name, []);
      case 'Unary':
        return make('Operación', expression.operator, [this.expression('valor', expression.operand)]);
      case 'Binary':
      case 'Logical':
        return make('Operación', expression.operator, [this.expression('izquierda', expression.left), this.expression('derecha', expression.right)]);
      case 'Call': {
        const args = expression.args.map((arg, index) => this.expression(`argumento ${index + 1}`, arg));
        if (expression.callee.kind === 'Variable') {
          return make('Llamada', expression.callee.name, args);
        }
        return make('Llamada', null, [this.expression('función', expression.callee), ...args]);
      }
      case 'Index':
        return make('Posición', null, [this.expression('de', expression.target), this.expression('posición', expression.index)]);
      case 'Assign':
        return make('Asignación', '=', [this.expression('destino', expression.target), this.expression('valor', expression.value)]);
    }
  }
}

// Convierte el árbol de sintaxis en nodos para mostrar, con el papel de cada hijo y su tipo
export const toDisplayTree = (program: Program, types: TypeInfo | null): DisplayNode => new TreeBuilder(types).program(program);
