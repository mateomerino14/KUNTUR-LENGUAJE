import type {TypeInfo} from '../checker/checker.js';
import {unknownType, type FunctionType, type RecordType, type Type} from '../checker/types.js';
import {createDiagnostic, type Diagnostic, type Position} from '../errors/diagnostic.js';
import {defaultMaxCallDepth, defaultMaxSteps} from '../interpreter/interpreter.js';
import type {
  Assign,
  Binary,
  Call,
  Expression,
  DictLiteral,
  For,
  ForEach,
  FunctionDeclaration,
  If,
  Index,
  Logical,
  Program,
  Statement,
  VarDeclaration,
  While,
} from '../parser/ast.js';
import {hostModuleName, hostSignatures, type HostFunctionName} from './host.js';
import {namesUsedInFunctions} from './references.js';
import {localizeMessage, type Language} from '../language/quechua.js';
import {LAYOUT, RUNTIME_GLOBALS, runtimeFunctions, TAGS, TEXT_HEADER_SIZE, WASI_IMPORTS, WASI_MODULE} from './wasi/runtime.js';
import {assembleBody} from './wasm/assembler.js';
import {utf8Bytes} from './wasm/encoding.js';
import {op, type Instruction, type ValueType} from './wasm/instructions.js';
import type {DefinedFunction, Global, ImportedFunction, NamedValue, WasmModule} from './wasm/module.js';

export type CompileTarget = 'browser' | 'wasi';

export interface CompileOptions {
  maxSteps?: number;
  maxCallDepth?: number;
  target?: CompileTarget;
  language?: Language;
}

export interface CompileResult {
  module: WasmModule | null;
  diagnostics: Diagnostic[];
}

interface VariableBinding {
  kind: 'variable';
  name: string;
  storage: 'global' | 'local';
  index: number;
  valueType: ValueType;
  declaredFlag: number | null;
}

interface FunctionBinding {
  kind: 'function';
  name: string;
  index: number;
  returns: ValueType | null;
}

type Binding = VariableBinding | FunctionBinding;

interface LoopLabels {
  breakLabel: number;
  continueLabel: number;
}

interface FunctionState {
  insideFunction: boolean;
  paramCount: number;
  locals: NamedValue[];
  usedNames: Set<string>;
  body: Instruction[];
  openLabels: number;
  loops: LoopLabels[];
}

export const mainFunctionName = 'principal';
export const memoryExportName = 'memoria';
export const wasiMainName = '_start';
export const wasiMemoryName = 'memory';

const wasmPageSize = 65536;
const stepsGlobalName = 'pasos';
const depthGlobalName = 'llamadas';

const runtimeTypeNames: Readonly<Record<string, string>> = {
  integer: 'número',
  decimal: 'número',
  text: 'texto',
  boolean: 'lógico',
  list: 'lista',
  dict: 'diccionario',
};

const numericComparisons = {'<': 'f64.lt', '<=': 'f64.le', '>': 'f64.gt', '>=': 'f64.ge'} as const;
const textComparisons = {'<': 'i32.lt_s', '<=': 'i32.le_s', '>': 'i32.gt_s', '>=': 'i32.ge_s'} as const;
const arithmeticOps = {'+': 'f64.add', '-': 'f64.sub', '*': 'f64.mul'} as const;

// Lleva los ámbitos de nombres del programa compilado
class CompileScope {
  private readonly bindings = new Map<string, Binding>();
  readonly parent: CompileScope | null;

  constructor(parent: CompileScope | null = null) {
    this.parent = parent;
  }

  // Asocia un nombre con su lugar en el módulo
  define(name: string, binding: Binding): void {
    this.bindings.set(name, binding);
  }

  // Busca un nombre en este ámbito y luego en los que lo contienen
  lookup(name: string): Binding | undefined {
    const binding = this.bindings.get(name);
    if (binding !== undefined) {
      return binding;
    }
    if (this.parent === null) {
      return undefined;
    }
    return this.parent.lookup(name);
  }
}

// Devuelve un nombre que no esté usado, agregando un número si hace falta
const uniqueName = (used: Set<string>, base: string): string => {
  let name = base;
  let suffix = 2;
  while (used.has(name)) {
    name = `${base}_${suffix}`;
    suffix++;
  }
  used.add(name);
  return name;
};

// Indica si las sentencias contienen un `retornar` con valor, sin entrar en funciones anidadas
const containsValueReturn = (statements: Statement[]): boolean => {
  return statements.some((statement) => {
    switch (statement.kind) {
      case 'Return':
        return statement.value !== null;
      case 'Block':
        return containsValueReturn(statement.statements);
      case 'While':
      case 'For':
      case 'ForEach':
        return containsValueReturn(statement.body.statements);
      case 'If':
        return containsValueReturnInIf(statement);
      default:
        return false;
    }
  });
};

// Indica si alguna rama del `si` contiene un `retornar` con valor
const containsValueReturnInIf = (statement: If): boolean => {
  if (containsValueReturn(statement.thenBranch.statements)) {
    return true;
  }
  if (statement.elseBranch === null) {
    return false;
  }
  if (statement.elseBranch.kind === 'If') {
    return containsValueReturnInIf(statement.elseBranch);
  }
  return containsValueReturn(statement.elseBranch.statements);
};

// Tipo de WebAssembly que representa un tipo de Kuntur, o null si todavía no se puede compilar; textos y listas usan el tipo de referencia del destino
const valueTypeOf = (type: Type, referenceType: ValueType): ValueType | null => {
  switch (type.kind) {
    case 'integer':
    case 'decimal':
      return 'f64';
    case 'boolean':
      return 'i32';
    case 'text':
      return referenceType;
    case 'record':
      return referenceType;
    case 'list':
    case 'dict':
      if (valueTypeOf(type.element, referenceType) === null) {
        return null;
      }
      return referenceType;
    default:
      return null;
  }
};

// Clase de valor según el tipo de Kuntur, para elegir cómo mostrarlo, convertirlo o guardarlo en una lista
const valueKind = (type: Type): 'number' | 'boolean' | 'text' | 'reference' => {
  if (type.kind === 'integer' || type.kind === 'decimal') {
    return 'number';
  }
  if (type.kind === 'boolean') {
    return 'boolean';
  }
  if (type.kind === 'text') {
    return 'text';
  }
  return 'reference';
};

// Alinea un número hacia arriba al múltiplo indicado
const alignTo = (value: number, alignment: number): number => Math.ceil(value / alignment) * alignment;

// Escribe un entero de 32 bits en orden little-endian
const int32Bytes = (value: number): number[] => [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff];

// Indica si el tipo es un número entero o decimal
const isNumber = (type: Type): boolean => type.kind === 'integer' || type.kind === 'decimal';

class CodeGenerator {
  private readonly types: TypeInfo;
  private readonly maxSteps: number;
  private readonly maxCallDepth: number;
  private readonly diagnostics: Diagnostic[] = [];
  private readonly reportedLines = new Set<number>();
  private readonly imports: ImportedFunction[] = [];
  private readonly importIndexes = new Map<string, number>();
  private readonly target: CompileTarget;
  private readonly language: Language;
  private readonly refType: ValueType;
  private readonly runtimeIndexes = new Map<string, number>();
  private readonly runtimeGlobalIndexes = new Map<string, number>();
  private readonly functions: DefinedFunction[] = [];
  private readonly functionNames = new Set<string>(Object.keys(hostSignatures));
  private readonly userCalls: {op: 'call'; index: number}[] = [];
  private readonly globals: Global[] = [];
  private readonly globalNames = new Set<string>();
  private readonly literals = new Map<string, {offset: number; length: number}>();
  private readonly dataBytes: number[] = [];
  private readonly globalScope = new CompileScope();
  private readonly stepsGlobal: number;
  private readonly depthGlobal: number;
  private state: FunctionState = this.newFunctionState(0, []);
  private namesInFunctions = new Set<string>();
  private tickHelper = 0;
  private enterCallHelper = 0;
  private exitCallHelper = 0;

  constructor(types: TypeInfo, options: CompileOptions) {
    this.types = types;
    this.maxSteps = options.maxSteps ?? defaultMaxSteps;
    this.maxCallDepth = options.maxCallDepth ?? defaultMaxCallDepth;
    this.target = options.target ?? 'browser';
    this.language = options.language ?? 'es';
    this.refType = 'externref';
    if (this.target === 'wasi') {
      this.refType = 'i32';
      this.reserveWasiMemory();
    }
    this.stepsGlobal = this.addGlobal(stepsGlobalName, 'i32');
    this.depthGlobal = this.addGlobal(depthGlobalName, 'i32');
  }

  // Reserva el inicio de la memoria para el runtime y escribe los dos objetos lógicos fijos
  private reserveWasiMemory(): void {
    this.dataBytes.push(...new Array<number>(LAYOUT.reservedEnd).fill(0));
    const booleanObjects: [number, number][] = [[LAYOUT.trueObject, 1], [LAYOUT.falseObject, 0]];
    for (const [address, value] of booleanObjects) {
      this.dataBytes.splice(address, 8, ...int32Bytes(TAGS.boolean), ...int32Bytes(value));
    }
    for (const global of RUNTIME_GLOBALS) {
      const index = this.addGlobal(global.name, global.type);
      let init: Instruction = {op: 'i32.const', value: global.initial};
      if (global.type === 'f64') {
        init = {op: 'f64.const', value: global.initial};
      }
      this.globals[index] = {...this.globals[index], init};
      this.runtimeGlobalIndexes.set(global.name, index);
    }
  }

  // Define las funciones del runtime independiente: primero sus índices, después sus cuerpos, que se llaman entre sí
  private defineWasiRuntime(): void {
    const definitions = runtimeFunctions(this.maxSteps, (message) => localizeMessage(message, this.language));
    for (const definition of definitions) {
      this.runtimeIndexes.set(definition.name, this.functions.length);
      this.functions.push({
        name: uniqueName(this.functionNames, definition.name),
        signature: {params: definition.params.map(([, type]) => type), results: definition.results},
        paramNames: definition.params.map(([name]) => name.replace(/^\$/, '')),
        locals: [],
        body: [],
      });
    }
    for (const definition of definitions) {
      const index = this.runtimeIndexes.get(definition.name)!;
      const variables = [...definition.params, ...definition.locals].map(([name]) => name.replace(/^\$/, ''));
      const body = assembleBody(definition.body, {
        local: (name) => this.indexOf(variables, name, definition.name),
        global: (name) => this.runtimeGlobalIndexes.get(name.replace(/^\$/, ''))!,
        call: (name) => this.runtimeCall(name.replace(/^\$/, '')),
        text: (value) => this.registerLiteral(value).offset - TEXT_HEADER_SIZE,
      });
      this.functions[index] = {
        ...this.functions[index],
        locals: definition.locals.map(([name, type]) => ({name: name.replace(/^\$/, ''), type})),
        body,
      };
    }
  }

  // Busca una variable del runtime por su nombre
  private indexOf(variables: string[], name: string, functionName: string): number {
    const index = variables.indexOf(name.replace(/^\$/, ''));
    if (index === -1) {
      throw new Error(`La variable ${name} no existe en la función ${functionName} del runtime`);
    }
    return index;
  }

  // Llamada desde el runtime: a una función de WASI o a otra función del runtime
  private runtimeCall(name: string): Instruction {
    const wasiSignature = WASI_IMPORTS[name];
    if (wasiSignature !== undefined) {
      return {op: 'call', index: this.importFunction(WASI_MODULE, name, wasiSignature)};
    }
    const index = this.runtimeIndexes.get(name);
    if (index === undefined) {
      throw new Error(`La función ${name} no existe en el runtime`);
    }
    const call: {op: 'call'; index: number} = {op: 'call', index};
    this.userCalls.push(call);
    return call;
  }

  // Compila el programa: declara las funciones, genera `principal` y después los cuerpos de las funciones
  compile(program: Program): CompileResult {
    if (this.target === 'wasi') {
      this.defineWasiRuntime();
    }
    this.defineRuntimeHelpers();
    this.namesInFunctions = namesUsedInFunctions(program);
    const declarations = program.statements.filter((statement) => statement.kind === 'FunctionDeclaration');
    const bindings = declarations.map((declaration) => this.declareFunction(declaration));
    const mainIndex = this.functions.length;
    const mainName = uniqueName(this.functionNames, mainFunctionName);
    this.state = this.newFunctionState(0, []);
    this.compileStatements(program.statements, this.globalScope, true);
    this.functions.push(this.finishFunction(mainName, {params: [], results: []}, []));
    declarations.forEach((declaration, index) => this.compileFunctionBody(declaration, bindings[index]));
    if (this.diagnostics.length > 0) {
      return {module: null, diagnostics: this.diagnostics};
    }
    for (const call of this.userCalls) {
      call.index += this.imports.length;
    }
    return {module: this.buildModule(mainIndex + this.imports.length), diagnostics: []};
  }

  // Arma el módulo final con la memoria de los textos y las exportaciones
  private buildModule(mainIndex: number): WasmModule {
    const pages = Math.max(1, Math.ceil(this.dataBytes.length / wasmPageSize));
    let data: WasmModule['data'] = [];
    if (this.dataBytes.length > 0) {
      data = [{offset: 0, bytes: this.dataBytes}];
    }
    let mainName = mainFunctionName;
    let memoryName = memoryExportName;
    if (this.target === 'wasi') {
      mainName = wasiMainName;
      memoryName = wasiMemoryName;
      // La memoria libre empieza después de los textos escritos en el programa
      const heap = this.runtimeGlobalIndexes.get('heap')!;
      this.globals[heap] = {...this.globals[heap], init: {op: 'i32.const', value: alignTo(this.dataBytes.length, 8)}};
    }
    return {
      imports: this.imports,
      functions: this.functions,
      globals: this.globals,
      memory: {name: memoryName, pages},
      exports: [
        {name: mainName, kind: 'function', index: mainIndex},
        {name: memoryName, kind: 'memory', index: 0},
      ],
      data,
    };
  }

  // Define las funciones auxiliares que cuentan pasos y llamadas, para no repetir ese código en cada ciclo
  private defineRuntimeHelpers(): void {
    const position = ['linea', 'columna'];
    this.tickHelper = this.defineHelper('contar_paso', position, () => {
      this.emit(
        {op: 'global.get', index: this.stepsGlobal},
        {op: 'i32.const', value: 1},
        op('i32.add'),
        {op: 'global.set', index: this.stepsGlobal},
        {op: 'global.get', index: this.stepsGlobal},
        {op: 'i32.const', value: this.maxSteps},
        op('i32.gt_s'),
      );
      this.openLabel({op: 'if', result: null});
      this.emit({op: 'local.get', index: 0}, {op: 'local.get', index: 1});
      this.callHost('fail_too_many_steps');
      this.closeLabel();
    });
    this.enterCallHelper = this.defineHelper('entrar_llamada', ['nombre_inicio', 'nombre_largo', ...position], () => {
      this.emit({op: 'global.get', index: this.depthGlobal}, {op: 'i32.const', value: this.maxCallDepth}, op('i32.ge_s'));
      this.openLabel({op: 'if', result: null});
      this.emit({op: 'local.get', index: 0}, {op: 'local.get', index: 1});
      this.callHost('text_literal');
      this.emit({op: 'local.get', index: 2}, {op: 'local.get', index: 3});
      this.callHost('fail_too_deep');
      this.closeLabel();
      this.emitDepthChange('i32.add');
    });
    this.exitCallHelper = this.defineHelper('salir_llamada', [], () => {
      this.emitDepthChange('i32.sub');
    });
  }

  // Define una función auxiliar con parámetros enteros y sin resultado
  private defineHelper(name: string, paramNames: string[], build: () => void): number {
    this.state = this.newFunctionState(paramNames.length, paramNames);
    build();
    const signature = {params: paramNames.map((): ValueType => 'i32'), results: []};
    this.functions.push(this.finishFunction(uniqueName(this.functionNames, name), signature, paramNames));
    return this.functions.length - 1;
  }

  // Suma o resta una llamada anidada al contador
  private emitDepthChange(operation: 'i32.add' | 'i32.sub'): void {
    this.emit({op: 'global.get', index: this.depthGlobal}, {op: 'i32.const', value: 1}, op(operation), {op: 'global.set', index: this.depthGlobal});
  }

  // Llama a una función definida en el módulo; su índice se corrige al final, cuando se conocen las importaciones
  private callDefined(index: number): void {
    const call: {op: 'call'; index: number} = {op: 'call', index};
    this.userCalls.push(call);
    this.emit(call);
  }

  // Registra una función del nivel superior con sus tipos, antes de compilar su cuerpo
  private declareFunction(declaration: FunctionDeclaration): FunctionBinding {
    const type: FunctionType | undefined = this.types.functions.get(declaration);
    const params = declaration.params.map((param, index) => {
      const valueType = valueTypeOf(type?.params[index] ?? unknownType, this.refType);
      if (valueType === null) {
        this.report(
          `Para compilar a WebAssembly, el parámetro \`${param.name}\` de \`${declaration.name}\` necesita su tipo, como \`${param.name}: entero\` o \`${param.name}: lista de texto\`.`,
          param.position,
        );
        return 'f64';
      }
      return valueType;
    });
    let returns: ValueType | null = null;
    if (declaration.returnType !== null) {
      returns = valueTypeOf(type?.returns ?? unknownType, this.refType);
      if (returns === null) {
        this.report(`Para compilar a WebAssembly, el tipo de retorno de \`${declaration.name}\` debe ser conocido.`, declaration.returnType.position);
        returns = 'f64';
      }
    }
    else if (containsValueReturn(declaration.body.statements)) {
      this.report(
        `Para compilar a WebAssembly, la función \`${declaration.name}\` necesita su tipo de retorno, por ejemplo: \`funcion ${declaration.name}(...): entero\`.`,
        declaration.position,
      );
    }
    const name = uniqueName(this.functionNames, declaration.name);
    const results: ValueType[] = [];
    if (returns !== null) {
      results.push(returns);
    }
    const binding: FunctionBinding = {kind: 'function', name: declaration.name, index: this.functions.length, returns};
    this.functions.push({name, signature: {params, results}, paramNames: declaration.params.map((param) => param.name), locals: [], body: []});
    this.globalScope.define(declaration.name, binding);
    return binding;
  }

  // Compila el cuerpo de una función ya declarada, con sus parámetros como variables locales
  private compileFunctionBody(declaration: FunctionDeclaration, binding: FunctionBinding): void {
    const placeholder = this.functions[binding.index];
    this.state = this.newFunctionState(declaration.params.length, placeholder.paramNames);
    this.state.insideFunction = true;
    const scope = new CompileScope(this.globalScope);
    placeholder.signature.params.forEach((valueType, index) => {
      const name = declaration.params[index].name;
      scope.define(name, {kind: 'variable', name, storage: 'local', index, valueType, declaredFlag: null});
    });
    this.compileStatements(declaration.body.statements, scope, false);
    if (binding.returns !== null) {
      // El análisis semántico garantiza que todos los caminos retornan; esto lo indica a WebAssembly
      this.emit(op('unreachable'));
    }
    this.functions[binding.index] = this.finishFunction(placeholder.name, placeholder.signature, placeholder.paramNames);
  }

  // Crea el estado vacío para generar una función
  private newFunctionState(paramCount: number, paramNames: string[]): FunctionState {
    return {insideFunction: false, paramCount, locals: [], usedNames: new Set(paramNames), body: [], openLabels: 0, loops: []};
  }

  // Cierra la función actual con sus variables locales y su código
  private finishFunction(name: string, signature: DefinedFunction['signature'], paramNames: string[]): DefinedFunction {
    return {name, signature, paramNames, locals: this.state.locals, body: this.state.body};
  }

  // Compila una lista de sentencias; en el nivel superior las variables son globales
  private compileStatements(statements: Statement[], scope: CompileScope, topLevel: boolean): void {
    for (const statement of statements) {
      this.compileStatement(statement, scope, topLevel);
    }
  }

  // Compila una sentencia según su clase
  private compileStatement(statement: Statement, scope: CompileScope, topLevel: boolean): void {
    switch (statement.kind) {
      case 'VarDeclaration':
        this.compileVarDeclaration(statement, scope, topLevel);
        return;
      case 'RecordDeclaration':
        return;
      case 'FunctionDeclaration':
        if (!topLevel) {
          this.report(
            `La función \`${statement.name}\` está dentro de otra función o de un bloque; eso todavía no se puede compilar a WebAssembly. Declárala fuera.`,
            statement.position,
          );
        }
        return;
      case 'Return':
        if (statement.value !== null) {
          this.compileValue(statement.value, scope);
        }
        this.emit(op('return'));
        return;
      case 'If':
        this.compileIf(statement, scope);
        return;
      case 'While':
        this.compileWhile(statement, scope);
        return;
      case 'For':
        this.compileFor(statement, scope);
        return;
      case 'ForEach':
        this.compileForEach(statement, scope);
        return;
      case 'Break':
        this.emit({op: 'br', depth: this.depthTo(this.state.loops.at(-1)!.breakLabel)});
        return;
      case 'Continue':
        this.emit({op: 'br', depth: this.depthTo(this.state.loops.at(-1)!.continueLabel)});
        return;
      case 'Block':
        this.compileStatements(statement.statements, new CompileScope(scope), false);
        return;
      case 'ExpressionStatement':
        if (this.compileExpression(statement.expression, scope) !== null) {
          this.emit(op('drop'));
        }
        return;
    }
  }

  // Compila una declaración: global en el nivel superior, local dentro de bloques y funciones
  private compileVarDeclaration(statement: VarDeclaration, scope: CompileScope, topLevel: boolean): void {
    const type = this.types.declarations.get(statement) ?? unknownType;
    let valueType = valueTypeOf(type, this.refType);
    if (valueType === null) {
      this.reportUnknownVariable(statement.name, type, statement.position);
      valueType = 'f64';
    }
    if (statement.initializer !== null) {
      this.compileValue(statement.initializer, scope);
    }
    else {
      this.emit(this.defaultValue(valueType));
    }
    if (topLevel) {
      const index = this.addGlobal(statement.name, valueType);
      this.emit({op: 'global.set', index});
      let declaredFlag: number | null = null;
      if (this.namesInFunctions.has(statement.name)) {
        // Una función puede llamarse antes de esta línea: la marca indica si la variable ya existe
        declaredFlag = this.addGlobal(`${statement.name}_declarada`, 'i32');
        this.emit({op: 'i32.const', value: 1}, {op: 'global.set', index: declaredFlag});
      }
      scope.define(statement.name, {kind: 'variable', name: statement.name, storage: 'global', index, valueType, declaredFlag});
    }
    else {
      const index = this.addLocal(statement.name, valueType);
      this.emit({op: 'local.set', index});
      scope.define(statement.name, {kind: 'variable', name: statement.name, storage: 'local', index, valueType, declaredFlag: null});
    }
  }

  // Explica qué le falta a una variable para poder compilarse
  private reportUnknownVariable(name: string, type: Type, position: Position): void {
    if (type.kind === 'list') {
      this.report(
        `Para compilar a WebAssembly, \`${name}\` necesita el tipo de sus elementos, por ejemplo: \`var ${name}: lista de entero = []\`.`,
        position,
      );
      return;
    }
    this.report(
      `Para compilar a WebAssembly, \`${name}\` necesita un tipo conocido. Dale un valor inicial o anota su tipo, por ejemplo: \`var ${name}: entero = 0\`.`,
      position,
    );
  }

  // Compila `si` con sus ramas; `sino si` queda como un `si` dentro del `else`
  private compileIf(statement: If, scope: CompileScope): void {
    this.compileValue(statement.condition, scope);
    this.openLabel({op: 'if', result: null});
    this.compileStatements(statement.thenBranch.statements, new CompileScope(scope), false);
    if (statement.elseBranch !== null) {
      this.emit(op('else'));
      if (statement.elseBranch.kind === 'If') {
        this.compileIf(statement.elseBranch, scope);
      }
      else {
        this.compileStatements(statement.elseBranch.statements, new CompileScope(scope), false);
      }
    }
    this.closeLabel();
  }

  // Compila `mientras` como un bloque de salida con un ciclo adentro
  private compileWhile(statement: While, scope: CompileScope): void {
    const breakLabel = this.openLabel({op: 'block', result: null});
    const loopLabel = this.openLabel({op: 'loop', result: null});
    this.emitTick(statement.position);
    this.compileValue(statement.condition, scope);
    this.emit(op('i32.eqz'), {op: 'br_if', depth: this.depthTo(breakLabel)});
    const continueLabel = this.openLabel({op: 'block', result: null});
    this.state.loops.push({breakLabel, continueLabel});
    this.compileStatements(statement.body.statements, new CompileScope(scope), false);
    this.state.loops.pop();
    this.closeLabel();
    this.emit({op: 'br', depth: this.depthTo(loopLabel)});
    this.closeLabel();
    this.closeLabel();
  }

  // Compila `para` calculando cada valor desde el inicio, igual que el intérprete
  private compileFor(statement: For, scope: CompileScope): void {
    const start = this.addLocal(`${statement.variable}_desde`, 'f64');
    const end = this.addLocal(`${statement.variable}_hasta`, 'f64');
    const step = this.addLocal(`${statement.variable}_paso`, 'f64');
    const iteration = this.addLocal(`${statement.variable}_vuelta`, 'f64');
    this.compileValue(statement.start, scope);
    this.emit({op: 'local.set', index: start});
    this.compileValue(statement.end, scope);
    this.emit({op: 'local.set', index: end});
    if (statement.step === null) {
      this.emit({op: 'f64.const', value: 1}, {op: 'local.set', index: step});
    }
    else {
      this.compileValue(statement.step, scope);
      this.emit({op: 'local.set', index: step});
      this.emit({op: 'local.get', index: step}, {op: 'f64.const', value: 0}, op('f64.eq'));
      this.emitFailure('fail_zero_step', statement.step.position);
    }
    this.emit({op: 'f64.const', value: 0}, {op: 'local.set', index: iteration});
    const loopScope = new CompileScope(scope);
    const current = this.addLocal(statement.variable, 'f64');
    loopScope.define(statement.variable, {
      kind: 'variable',
      name: statement.variable,
      storage: 'local',
      index: current,
      valueType: 'f64',
      declaredFlag: null,
    });
    const breakLabel = this.openLabel({op: 'block', result: null});
    const loopLabel = this.openLabel({op: 'loop', result: null});
    this.emit(
      {op: 'local.get', index: start},
      {op: 'local.get', index: iteration},
      {op: 'local.get', index: step},
      op('f64.mul'),
      op('f64.add'),
      {op: 'local.set', index: current},
    );
    this.emitPastEnd(step, current, end, 'f64.gt');
    this.emitPastEnd(step, current, end, 'f64.lt');
    this.emit(op('i32.or'), {op: 'br_if', depth: this.depthTo(breakLabel)});
    this.emitTick(statement.position);
    const continueLabel = this.openLabel({op: 'block', result: null});
    this.state.loops.push({breakLabel, continueLabel});
    this.compileStatements(statement.body.statements, new CompileScope(loopScope), false);
    this.state.loops.pop();
    this.closeLabel();
    this.emit(
      {op: 'local.get', index: iteration},
      {op: 'f64.const', value: 1},
      op('f64.add'),
      {op: 'local.set', index: iteration},
      {op: 'br', depth: this.depthTo(loopLabel)},
    );
    this.closeLabel();
    this.closeLabel();
  }

  // Compila `para cada`: recorre por posición hasta el largo inicial, o antes si la lista se acorta, como el intérprete
  private compileForEach(statement: ForEach, scope: CompileScope): void {
    const elementType = this.types.loops.get(statement) ?? unknownType;
    const valueType = valueTypeOf(elementType, this.refType);
    if (valueType === null) {
      this.report(
        'Para compilar a WebAssembly, `para cada` necesita conocer el tipo de los elementos; anota la lista, por ejemplo: `lista de entero`.',
        statement.iterable.position,
      );
      return;
    }
    const iterableKind = this.typeOf(statement.iterable).kind;
    const isText = iterableKind === 'text';
    const container = this.addLocal(`${statement.variable}_recorrido`, this.refType);
    const total = this.addLocal(`${statement.variable}_total`, 'f64');
    const index = this.addLocal(`${statement.variable}_posicion`, 'f64');
    this.compileValue(statement.iterable, scope);
    if (iterableKind === 'dict') {
      this.callHost('dict_keys');
    }
    this.emit({op: 'local.tee', index: container});
    this.callHost('length');
    this.emit({op: 'local.set', index: total}, {op: 'f64.const', value: 0}, {op: 'local.set', index});
    const loopScope = new CompileScope(scope);
    const current = this.addLocal(statement.variable, valueType);
    loopScope.define(statement.variable, {kind: 'variable', name: statement.variable, storage: 'local', index: current, valueType, declaredFlag: null});
    const breakLabel = this.openLabel({op: 'block', result: null});
    const loopLabel = this.openLabel({op: 'loop', result: null});
    this.emit({op: 'local.get', index}, {op: 'local.get', index: total}, op('f64.ge'), {op: 'local.get', index}, {op: 'local.get', index: container});
    this.callHost('length');
    this.emit(op('f64.ge'), op('i32.or'), {op: 'br_if', depth: this.depthTo(breakLabel)});
    this.emitTick(statement.position);
    this.emit({op: 'local.get', index: container}, {op: 'local.get', index});
    this.emitPosition(statement.iterable.position);
    if (isText) {
      this.callHost('text_at');
    }
    else {
      this.callHost('list_get');
      this.emitUnbox(elementType);
    }
    this.emit({op: 'local.set', index: current});
    const continueLabel = this.openLabel({op: 'block', result: null});
    this.state.loops.push({breakLabel, continueLabel});
    this.compileStatements(statement.body.statements, new CompileScope(loopScope), false);
    this.state.loops.pop();
    this.closeLabel();
    this.emit(
      {op: 'local.get', index},
      {op: 'f64.const', value: 1},
      op('f64.add'),
      {op: 'local.set', index},
      {op: 'br', depth: this.depthTo(loopLabel)},
    );
    this.closeLabel();
    this.closeLabel();
  }

  // Deja en la pila si el ciclo ya pasó el final en una dirección: paso positivo y mayor, o negativo y menor
  private emitPastEnd(step: number, current: number, end: number, comparison: 'f64.gt' | 'f64.lt'): void {
    this.emit(
      {op: 'local.get', index: step},
      {op: 'f64.const', value: 0},
      op(comparison),
      {op: 'local.get', index: current},
      {op: 'local.get', index: end},
      op(comparison),
      op('i32.and'),
    );
  }

  // Compila una expresión que debe producir un valor
  private compileValue(expression: Expression, scope: CompileScope): ValueType {
    const valueType = this.compileExpression(expression, scope);
    if (valueType === null) {
      let subject = 'Esta llamada';
      if (expression.kind === 'Call' && expression.callee.kind === 'Variable') {
        subject = `La función \`${expression.callee.name}\``;
      }
      this.report(`${subject} no retorna ningún valor; no se puede usar su resultado.`, expression.position);
      return 'f64';
    }
    return valueType;
  }

  // Compila una expresión y devuelve el tipo del valor que deja en la pila, o null si no deja ninguno
  private compileExpression(expression: Expression, scope: CompileScope): ValueType | null {
    switch (expression.kind) {
      case 'NumberLiteral':
        this.emit({op: 'f64.const', value: expression.value});
        return 'f64';
      case 'StringLiteral':
        this.emitText(expression.value);
        return this.refType;
      case 'BooleanLiteral':
        this.emit(this.flag(expression.value));
        return 'i32';
      case 'NullLiteral':
        this.report('`nulo` todavía no se puede compilar a WebAssembly, salvo para comparar con `==` o `!=`.', expression.position);
        return 'f64';
      case 'ListLiteral':
        return this.compileList(expression.elements, this.typeOf(expression), scope, expression.position);
      case 'DictLiteral':
        return this.compileDict(expression, scope);
      case 'Field':
        this.compileValue(expression.target, scope);
        this.emitText(expression.name);
        this.callHost('record_get');
        return this.emitUnbox(this.typeOf(expression));
      case 'Variable':
        return this.compileVariable(expression.name, scope, expression.position);
      case 'Assign':
        return this.compileAssign(expression, scope);
      case 'Unary':
        this.compileValue(expression.operand, scope);
        if (expression.operator === 'no') {
          this.emit(op('i32.eqz'));
          return 'i32';
        }
        this.emit(op('f64.neg'));
        return 'f64';
      case 'Logical':
        return this.compileLogical(expression, scope);
      case 'Binary':
        return this.compileBinary(expression, scope);
      case 'Call':
        return this.compileCall(expression, scope);
      case 'Index':
        return this.compileIndex(expression, scope);
    }
  }

  // Crea una lista vacía y le agrega cada elemento
  private compileList(elements: Expression[], type: Type, scope: CompileScope, position: Position): ValueType {
    if (type.kind !== 'list' || valueTypeOf(type, this.refType) === null) {
      this.report(
        'Para compilar a WebAssembly, esta lista necesita el tipo de sus elementos; anota la variable, por ejemplo: `var lista: lista de entero = []`.',
        position,
      );
      return this.refType;
    }
    const list = this.addLocal('lista_nueva', this.refType);
    this.callHost('list_new');
    this.emit({op: 'local.set', index: list});
    for (const element of elements) {
      this.emit({op: 'local.get', index: list});
      this.compileValue(element, scope);
      this.emitBox(this.typeOf(element));
      this.callHost('list_push');
    }
    this.emit({op: 'local.get', index: list});
    return this.refType;
  }

  // Crea un diccionario vacío y le guarda cada clave con su valor
  private compileDict(expression: DictLiteral, scope: CompileScope): ValueType {
    const type = this.typeOf(expression);
    if (type.kind !== 'dict' || valueTypeOf(type, this.refType) === null) {
      this.report(
        'Para compilar a WebAssembly, este diccionario necesita el tipo de sus valores; anota la variable, por ejemplo: `var edades: diccionario de entero = {}`.',
        expression.position,
      );
      return this.refType;
    }
    const dict = this.addLocal('diccionario_nuevo', this.refType);
    this.callHost('dict_new');
    this.emit({op: 'local.set', index: dict});
    for (const entry of expression.entries) {
      this.emit({op: 'local.get', index: dict});
      this.compileValue(entry.key, scope);
      this.compileValue(entry.value, scope);
      this.emitBox(this.typeOf(entry.value));
      this.callHost('dict_set');
    }
    this.emit({op: 'local.get', index: dict});
    return this.refType;
  }

  // Lee una variable local o global
  private compileVariable(name: string, scope: CompileScope, position: Position): ValueType {
    const binding = scope.lookup(name);
    if (binding === undefined || binding.kind === 'function') {
      this.report(
        `\`${name}\` es una función; usarla como valor, sin llamarla, todavía no se puede compilar a WebAssembly.`,
        position,
      );
      return 'f64';
    }
    this.emitDeclaredCheck(binding, 'fail_not_declared', position);
    if (binding.storage === 'global') {
      this.emit({op: 'global.get', index: binding.index});
    }
    else {
      this.emit({op: 'local.get', index: binding.index});
    }
    return binding.valueType;
  }

  // Dentro de una función, falla si la variable global todavía no se declaró, igual que el intérprete
  private emitDeclaredCheck(binding: VariableBinding, failure: 'fail_not_declared' | 'fail_assign_not_declared', position: Position): void {
    if (!this.state.insideFunction || binding.declaredFlag === null) {
      return;
    }
    this.emit({op: 'global.get', index: binding.declaredFlag}, op('i32.eqz'));
    this.openLabel({op: 'if', result: null});
    this.emitText(binding.name);
    this.emitPosition(position);
    this.callHost(failure);
    this.closeLabel();
  }

  // Asigna un valor y lo deja en la pila, porque la asignación también es una expresión
  private compileAssign(expression: Assign, scope: CompileScope): ValueType {
    const target = expression.target;
    if (target.kind === 'Field') {
      const valueType = this.compileValue(expression.value, scope);
      const value = this.addLocal('valor_asignado', valueType);
      this.emit({op: 'local.set', index: value});
      this.compileValue(target.target, scope);
      this.emitText(target.name);
      this.emit({op: 'local.get', index: value});
      this.emitBox(this.typeOf(target));
      this.callHost('record_set');
      this.emit({op: 'local.get', index: value});
      return valueType;
    }
    if (target.kind === 'Index') {
      const valueType = this.compileValue(expression.value, scope);
      const value = this.addLocal('valor_asignado', valueType);
      this.emit({op: 'local.set', index: value});
      this.compileValue(target.target, scope);
      this.compileValue(target.index, scope);
      this.emit({op: 'local.get', index: value});
      this.emitBox(this.typeOf(expression.value));
      if (this.typeOf(target.target).kind === 'dict') {
        this.callHost('dict_set');
      }
      else {
        this.emitPosition(target.position);
        this.callHost('list_set');
      }
      this.emit({op: 'local.get', index: value});
      return valueType;
    }
    const binding = scope.lookup(target.name);
    const valueType = this.compileValue(expression.value, scope);
    if (binding === undefined || binding.kind === 'function') {
      return valueType;
    }
    this.emitDeclaredCheck(binding, 'fail_assign_not_declared', target.position);
    if (binding.storage === 'global') {
      this.emit({op: 'global.set', index: binding.index}, {op: 'global.get', index: binding.index});
    }
    else {
      this.emit({op: 'local.tee', index: binding.index});
    }
    return valueType;
  }

  // Compila `y` y `o` sin evaluar la derecha si la izquierda ya decide el resultado
  private compileLogical(expression: Logical, scope: CompileScope): ValueType {
    this.compileValue(expression.left, scope);
    this.openLabel({op: 'if', result: 'i32'});
    if (expression.operator === 'y') {
      this.compileValue(expression.right, scope);
      this.emit(op('else'), this.flag(false));
    }
    else {
      this.emit(this.flag(true), op('else'));
      this.compileValue(expression.right, scope);
    }
    this.closeLabel();
    return 'i32';
  }

  // Compila operaciones aritméticas, uniones de textos y listas, comparaciones e igualdades
  private compileBinary(expression: Binary, scope: CompileScope): ValueType {
    const leftType = this.typeOf(expression.left);
    const rightType = this.typeOf(expression.right);
    switch (expression.operator) {
      case '==':
      case '!=':
        return this.compileEquality(expression, leftType, scope);
      case '<':
      case '<=':
      case '>':
      case '>=':
        return this.compileComparison(expression, expression.operator, leftType, scope);
      case '+':
        if (leftType.kind === 'text' || rightType.kind === 'text') {
          this.compileValue(expression.left, scope);
          this.emitAsText(leftType);
          this.compileValue(expression.right, scope);
          this.emitAsText(rightType);
          this.callHost('text_concat');
          return this.refType;
        }
        if (leftType.kind === 'list') {
          this.compileValue(expression.left, scope);
          this.compileValue(expression.right, scope);
          this.callHost('list_concat');
          return this.refType;
        }
        return this.compileArithmetic(expression, scope);
      case '-':
      case '*':
        return this.compileArithmetic(expression, scope);
      case '/':
        this.compileValue(expression.left, scope);
        this.emitNonZeroDivisor(expression, scope);
        this.emit(op('f64.div'));
        return 'f64';
      case '%':
        return this.compileRemainder(expression, scope);
    }
  }

  // Suma, resta o multiplica dos números
  private compileArithmetic(expression: Binary, scope: CompileScope): ValueType {
    this.compileValue(expression.left, scope);
    this.compileValue(expression.right, scope);
    this.emit(op(arithmeticOps[expression.operator as keyof typeof arithmeticOps]));
    return 'f64';
  }

  // Calcula el divisor y lo deja en la pila, fallando si es cero
  private emitNonZeroDivisor(expression: Binary, scope: CompileScope): number {
    const divisor = this.addLocal('divisor', 'f64');
    this.compileValue(expression.right, scope);
    this.emit({op: 'local.tee', index: divisor}, {op: 'f64.const', value: 0}, op('f64.eq'));
    this.emitFailure('fail_division_by_zero', expression.position);
    this.emit({op: 'local.get', index: divisor});
    return divisor;
  }

  // Calcula el residuo como en JavaScript: a - b * trunc(a / b)
  private compileRemainder(expression: Binary, scope: CompileScope): ValueType {
    const dividend = this.addLocal('dividendo', 'f64');
    this.compileValue(expression.left, scope);
    this.emit({op: 'local.set', index: dividend});
    const divisor = this.emitNonZeroDivisor(expression, scope);
    this.emit(
      op('drop'),
      {op: 'local.get', index: dividend},
      {op: 'local.get', index: dividend},
      {op: 'local.get', index: divisor},
      op('f64.div'),
      op('f64.trunc'),
      {op: 'local.get', index: divisor},
      op('f64.mul'),
      op('f64.sub'),
    );
    return 'f64';
  }

  // Compara dos números o dos textos
  private compileComparison(expression: Binary, operator: keyof typeof numericComparisons, leftType: Type, scope: CompileScope): ValueType {
    this.compileValue(expression.left, scope);
    this.compileValue(expression.right, scope);
    if (isNumber(leftType)) {
      this.emit(op(numericComparisons[operator]));
    }
    else {
      this.callHost('text_compare');
      this.emit({op: 'i32.const', value: 0}, op(textComparisons[operator]));
    }
    return 'i32';
  }

  // Compara la igualdad según el tipo; con `nulo` el resultado se conoce sin ejecutar
  private compileEquality(expression: Binary, leftType: Type, scope: CompileScope): ValueType {
    const negate = expression.operator === '!=';
    const leftIsNull = expression.left.kind === 'NullLiteral';
    const rightIsNull = expression.right.kind === 'NullLiteral';
    if (leftIsNull || rightIsNull) {
      if (!leftIsNull) {
        this.compileValue(expression.left, scope);
        this.emit(op('drop'));
      }
      if (!rightIsNull) {
        this.compileValue(expression.right, scope);
        this.emit(op('drop'));
      }
      this.emit(this.flag((leftIsNull && rightIsNull) !== negate));
      return 'i32';
    }
    this.compileValue(expression.left, scope);
    this.compileValue(expression.right, scope);
    if (isNumber(leftType)) {
      this.emitEqualityOp('f64.eq', 'f64.ne', negate);
    }
    else if (leftType.kind === 'boolean') {
      this.emitEqualityOp('i32.eq', 'i32.ne', negate);
    }
    else {
      this.callHost('values_equal');
      if (negate) {
        this.emit(op('i32.eqz'));
      }
    }
    return 'i32';
  }

  // Elige la instrucción de igualdad o de diferencia
  private emitEqualityOp(equal: 'f64.eq' | 'i32.eq', notEqual: 'f64.ne' | 'i32.ne', negate: boolean): void {
    if (negate) {
      this.emit(op(notEqual));
    }
    else {
      this.emit(op(equal));
    }
  }

  // Compila una llamada a una función propia o del usuario
  private compileCall(expression: Call, scope: CompileScope): ValueType | null {
    if (expression.callee.kind !== 'Variable') {
      this.report('Solo se pueden llamar funciones por su nombre al compilar a WebAssembly.', expression.position);
      return 'f64';
    }
    const record = this.types.records.get(expression.callee.name);
    if (record !== undefined && scope.lookup(expression.callee.name) === undefined) {
      return this.compileRecordNew(record, expression, scope);
    }
    const binding = scope.lookup(expression.callee.name);
    if (binding === undefined) {
      return this.compileBuiltinCall(expression.callee.name, expression, scope);
    }
    if (binding.kind !== 'function') {
      return 'f64';
    }
    this.emitTick(expression.position);
    this.emitEnterCall(binding.name, expression.position);
    for (const arg of expression.args) {
      this.compileValue(arg, scope);
    }
    this.callDefined(binding.index);
    this.callDefined(this.exitCallHelper);
    return binding.returns;
  }

  // Crea un registro con su nombre y guarda cada argumento en su campo
  private compileRecordNew(record: RecordType, expression: Call, scope: CompileScope): ValueType {
    const value = this.addLocal('registro_nuevo', this.refType);
    this.emitText(record.name);
    this.callHost('record_new');
    this.emit({op: 'local.set', index: value});
    record.fields.forEach((field, index) => {
      this.emit({op: 'local.get', index: value});
      this.emitText(field.name);
      this.compileValue(expression.args[index], scope);
      this.emitBox(field.type);
      this.callHost('record_set');
    });
    this.emit({op: 'local.get', index: value});
    return this.refType;
  }

  // Compila una llamada a una función propia del lenguaje
  private compileBuiltinCall(name: string, expression: Call, scope: CompileScope): ValueType | null {
    const args = expression.args;
    switch (name) {
      case 'mostrar':
        this.callHost('line_start');
        for (const arg of args) {
          this.compileValue(arg, scope);
          this.emitAppend(this.typeOf(arg));
        }
        this.callHost('line_end');
        return null;
      case 'longitud':
        this.compileValue(args[0], scope);
        this.callHost('length');
        return 'f64';
      case 'agregar':
        this.compileValue(args[0], scope);
        this.compileValue(args[1], scope);
        this.emitBox(this.typeOf(args[1]));
        this.callHost('list_push');
        return null;
      case 'quitar':
        this.compileValue(args[0], scope);
        this.emitPosition(expression.position);
        this.callHost('list_pop');
        return this.emitUnbox(this.typeOf(expression));
      case 'tiene':
        this.compileValue(args[0], scope);
        this.compileValue(args[1], scope);
        this.callHost('dict_has');
        return 'i32';
      case 'claves':
        this.compileValue(args[0], scope);
        this.callHost('dict_keys');
        return this.refType;
      case 'texto':
        this.compileValue(args[0], scope);
        this.emitAsText(this.typeOf(args[0]));
        return this.refType;
      case 'numero':
        return this.compileToNumber(args[0], expression.position, scope);
      case 'tipo':
        this.compileValue(args[0], scope);
        this.emit(op('drop'));
        this.emitText(this.runtimeTypeName(this.typeOf(args[0])));
        return this.refType;
      case 'redondear':
        this.compileValue(args[0], scope);
        this.emit({op: 'f64.const', value: 0.5}, op('f64.add'), op('f64.floor'));
        return 'f64';
      case 'raiz':
        this.compileValue(args[0], scope);
        this.emitPosition(expression.position);
        this.callHost('square_root');
        return 'f64';
      case 'leer':
        this.compileValue(args[0], scope);
        this.emitPosition(expression.position);
        this.callHost('read_line');
        return this.refType;
      case 'aleatorio':
        this.compileValue(args[0], scope);
        this.compileValue(args[1], scope);
        this.emitPosition(expression.position);
        this.callHost('random_int');
        return 'f64';
      default:
        return 'f64';
    }
  }

  // Nombre que devuelve `tipo()`: el del registro o el de la clase de valor
  private runtimeTypeName(type: Type): string {
    if (type.kind === 'record') {
      return type.name;
    }
    return runtimeTypeNames[type.kind];
  }

  // Convierte un texto en número; si ya es número lo deja igual
  private compileToNumber(arg: Expression, position: Position, scope: CompileScope): ValueType {
    this.compileValue(arg, scope);
    if (this.typeOf(arg).kind === 'text') {
      this.emitPosition(position);
      this.callHost('parse_number');
    }
    return 'f64';
  }

  // Lee un elemento de una lista o un carácter de un texto
  private compileIndex(expression: Index, scope: CompileScope): ValueType {
    const containerType = this.typeOf(expression.target);
    this.compileValue(expression.target, scope);
    this.compileValue(expression.index, scope);
    this.emitPosition(expression.position);
    if (containerType.kind === 'text') {
      this.callHost('text_at');
      return this.refType;
    }
    if (containerType.kind === 'dict') {
      this.callHost('dict_get');
      return this.emitUnbox(this.typeOf(expression));
    }
    this.callHost('list_get');
    return this.emitUnbox(this.typeOf(expression));
  }

  // Agrega el valor a la línea que está armando `mostrar`
  private emitAppend(type: Type): void {
    const kind = valueKind(type);
    if (kind === 'number') {
      this.callHost('append_number');
    }
    else if (kind === 'boolean') {
      this.callHost('append_bool');
    }
    else {
      this.callHost('append_ref');
    }
  }

  // Convierte el valor de la pila en texto, como lo haría `texto()`
  private emitAsText(type: Type): void {
    const kind = valueKind(type);
    if (kind === 'number') {
      this.callHost('number_to_text');
    }
    else if (kind === 'boolean') {
      this.callHost('bool_to_text');
    }
    else if (kind !== 'text') {
      this.callHost('ref_to_text');
    }
  }

  // Convierte el valor de la pila en una referencia para guardarlo en una lista
  private emitBox(type: Type): void {
    const kind = valueKind(type);
    if (kind === 'number') {
      this.callHost('box_number');
    }
    else if (kind === 'boolean') {
      this.callHost('box_bool');
    }
  }

  // Convierte una referencia leída de una lista en el valor de su tipo
  private emitUnbox(type: Type): ValueType {
    const kind = valueKind(type);
    if (kind === 'number') {
      this.callHost('unbox_number');
    }
    else if (kind === 'boolean') {
      this.callHost('unbox_bool');
    }
    return valueTypeOf(type, this.refType) ?? this.refType;
  }

  // Guarda un texto en la memoria del módulo una sola vez; en WASI lleva delante su etiqueta y su largo, como cualquier texto
  private registerLiteral(text: string): {offset: number; length: number} {
    let literal = this.literals.get(text);
    if (literal === undefined) {
      const bytes = utf8Bytes(text);
      if (this.target === 'wasi') {
        while (this.dataBytes.length % 4 !== 0) {
          this.dataBytes.push(0);
        }
        this.dataBytes.push(...int32Bytes(TAGS.text), ...int32Bytes(bytes.length));
      }
      literal = {offset: this.dataBytes.length, length: bytes.length};
      this.dataBytes.push(...bytes);
      this.literals.set(text, literal);
    }
    return literal;
  }

  // Deja en la pila el inicio y el largo de un texto guardado en la memoria del módulo
  private emitLiteralBounds(text: string): void {
    const literal = this.registerLiteral(text);
    this.emit({op: 'i32.const', value: literal.offset}, {op: 'i32.const', value: literal.length});
  }

  // Deja un texto en la pila a partir de sus bytes en la memoria del módulo
  private emitText(text: string): void {
    this.emitLiteralBounds(text);
    this.callHost('text_literal');
  }

  // Cuenta un paso y falla si se superó el límite, igual que el intérprete
  private emitTick(position: Position): void {
    this.emitPosition(position);
    this.callDefined(this.tickHelper);
  }

  // Cuenta una llamada anidada y falla si son demasiadas
  private emitEnterCall(name: string, position: Position): void {
    this.emitLiteralBounds(name);
    this.emitPosition(position);
    this.callDefined(this.enterCallHelper);
  }

  // Si la condición de la pila es verdadera, llama a la función del anfitrión que lanza el error
  private emitFailure(name: HostFunctionName, position: Position): void {
    this.openLabel({op: 'if', result: null});
    this.emitPosition(position);
    this.callHost(name);
    this.closeLabel();
  }

  // Deja en la pila la línea y la columna, para que el anfitrión señale el error
  private emitPosition(position: Position): void {
    this.emit({op: 'i32.const', value: position.line}, {op: 'i32.const', value: position.column});
  }

  // Valor inicial de una variable según su tipo
  private defaultValue(valueType: ValueType): Instruction {
    if (valueType === 'f64') {
      return {op: 'f64.const', value: 0};
    }
    if (valueType === 'i32') {
      return {op: 'i32.const', value: 0};
    }
    return {op: 'ref.null'};
  }

  // Instrucción que deja verdadero o falso en la pila
  private flag(value: boolean): Instruction {
    if (value) {
      return {op: 'i32.const', value: 1};
    }
    return {op: 'i32.const', value: 0};
  }

  // Llama a una operación del anfitrión: importada de JavaScript en el navegador, o del runtime propio en WASI
  private callHost(name: HostFunctionName): void {
    if (this.target === 'wasi') {
      this.callDefined(this.runtimeIndexes.get(name)!);
      return;
    }
    this.emit({op: 'call', index: this.importFunction(hostModuleName, name, hostSignatures[name])});
  }

  // Importa una función la primera vez que se usa y devuelve su índice
  private importFunction(module: string, field: string, signature: DefinedFunction['signature']): number {
    const key = `${module}.${field}`;
    let index = this.importIndexes.get(key);
    if (index === undefined) {
      index = this.imports.length;
      this.imports.push({module, field, name: field, signature});
      this.importIndexes.set(key, index);
    }
    return index;
  }

  // Abre un bloque, ciclo o condicional y devuelve su etiqueta
  private openLabel(instruction: Instruction): number {
    this.emit(instruction);
    this.state.openLabels++;
    return this.state.openLabels - 1;
  }

  // Cierra el último bloque abierto
  private closeLabel(): void {
    this.emit(op('end'));
    this.state.openLabels--;
  }

  // Calcula cuántos bloques hay que saltar para llegar a la etiqueta
  private depthTo(label: number): number {
    return this.state.openLabels - 1 - label;
  }

  // Agrega una variable global con un nombre único
  private addGlobal(name: string, type: ValueType): number {
    this.globals.push({name: uniqueName(this.globalNames, name), type, init: this.defaultValue(type)});
    return this.globals.length - 1;
  }

  // Agrega una variable local con un nombre único y devuelve su índice
  private addLocal(name: string, type: ValueType): number {
    this.state.locals.push({name: uniqueName(this.state.usedNames, name), type});
    return this.state.paramCount + this.state.locals.length - 1;
  }

  // Tipo que el análisis semántico calculó para la expresión
  private typeOf(expression: Expression): Type {
    return this.types.expressions.get(expression) ?? unknownType;
  }

  // Agrega instrucciones al cuerpo de la función actual
  private emit(...instructions: Instruction[]): void {
    this.state.body.push(...instructions);
  }

  // Registra un error de compilación, uno por línea para no repetir avisos en cadena
  private report(message: string, position: Position): void {
    if (this.reportedLines.has(position.line)) {
      return;
    }
    this.reportedLines.add(position.line);
    this.diagnostics.push(createDiagnostic('compiler', message, position));
  }
}

// Traduce un programa ya revisado a un módulo de WebAssembly
export const compileProgram = (program: Program, types: TypeInfo, options: CompileOptions = {}): CompileResult => {
  return new CodeGenerator(types, options).compile(program);
};
