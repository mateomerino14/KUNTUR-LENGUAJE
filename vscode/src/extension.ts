import * as vscode from 'vscode';
import {check, compile, translateSource, type Diagnostic, type Language, type Stage} from '../../src/index.js';
import {createProgramTerminal} from './programTerminal.js';
import {tokenColumns} from './ranges.js';

const languageId = 'kuntur';
const settingsSection = 'kuntur';
const languageSetting = 'idioma';
const quechuaSetting = 'runasimi';
const spanishSetting = 'español';
const refreshDelayMs = 250;
const quechuaFlag = '--runasimi';
const terminalName = 'Kuntur';

const stageNames: Readonly<Record<Stage, string>> = {
  lexer: 'léxico',
  parser: 'sintaxis',
  semantic: 'semántica',
  compiler: 'WebAssembly',
  runtime: 'ejecución',
};

// Idioma de las palabras del lenguaje según la configuración
const currentLanguage = (): Language => {
  if (vscode.workspace.getConfiguration(settingsSection).get<string>(languageSetting) === quechuaSetting) {
    return 'qu';
  }
  return 'es';
};

// Convierte un error de Kuntur en un error del editor, subrayando el token donde ocurre
const toEditorDiagnostic = (diagnostic: Diagnostic, document: vscode.TextDocument, severity: vscode.DiagnosticSeverity): vscode.Diagnostic => {
  const line = Math.min(Math.max(diagnostic.position.line - 1, 0), document.lineCount - 1);
  const columns = tokenColumns(document.lineAt(line).text, diagnostic.position.column);
  const range = new vscode.Range(line, columns.start, line, columns.end);
  const result = new vscode.Diagnostic(range, diagnostic.message, severity);
  result.source = 'Kuntur';
  result.code = stageNames[diagnostic.stage];
  return result;
};

// Revisa el programa como lo haría al ejecutarlo; si está bien, avisa lo que todavía no se puede compilar a WebAssembly
const diagnosticsFor = (document: vscode.TextDocument): vscode.Diagnostic[] => {
  const language = currentLanguage();
  const source = document.getText();
  const checked = check(source, {language});
  if (checked.diagnostics.length > 0) {
    return checked.diagnostics.map((diagnostic) => toEditorDiagnostic(diagnostic, document, vscode.DiagnosticSeverity.Error));
  }
  const compiled = compile(source, {language});
  return compiled.diagnostics.map((diagnostic) => toEditorDiagnostic(diagnostic, document, vscode.DiagnosticSeverity.Information));
};

// Editor activo si tiene un programa de Kuntur; si no, avisa y devuelve null
const activeKunturEditor = (): vscode.TextEditor | null => {
  const editor = vscode.window.activeTextEditor;
  if (editor === undefined || editor.document.languageId !== languageId) {
    void vscode.window.showWarningMessage('Abre un archivo .kun para usar este comando.');
    return null;
  }
  return editor;
};

// Guarda el archivo para que la terminal ejecute lo que se ve en el editor
const savedFilePath = async (document: vscode.TextDocument): Promise<string | null> => {
  if (document.isUntitled) {
    void vscode.window.showWarningMessage('Guarda el archivo con la extensión .kun antes de ejecutarlo.');
    return null;
  }
  if (document.isDirty && !await document.save()) {
    return null;
  }
  return document.uri.fsPath;
};

// Ejecuta el archivo en una terminal propia, con el Node de VS Code, para poder responder a `leer`; devuelve el código de salida
const runFile = async (context: vscode.ExtensionContext): Promise<number | null> => {
  const editor = activeKunturEditor();
  if (editor === null) {
    return null;
  }
  const path = await savedFilePath(editor.document);
  if (path === null) {
    return null;
  }
  const args = [context.asAbsolutePath('dist/kuntur.mjs')];
  if (currentLanguage() === 'qu') {
    args.push(quechuaFlag);
  }
  args.push(path);
  vscode.window.terminals.filter((terminal) => terminal.name === terminalName).forEach((terminal) => terminal.dispose());
  return new Promise((resolve) => {
    const terminal = vscode.window.createTerminal({name: terminalName, pty: createProgramTerminal(args, resolve)});
    terminal.show();
  });
};

// Muestra al lado el WebAssembly del programa en formato de texto
const showWebAssembly = async (): Promise<void> => {
  const editor = activeKunturEditor();
  if (editor === null) {
    return;
  }
  const compiled = compile(editor.document.getText(), {language: currentLanguage()});
  if (compiled.text === null) {
    void vscode.window.showErrorMessage(`No se pudo compilar: ${compiled.diagnostics[0].message}`);
    return;
  }
  const document = await vscode.workspace.openTextDocument({content: compiled.text, language: 'wat'});
  await vscode.window.showTextDocument(document, {viewColumn: vscode.ViewColumn.Beside, preview: true});
};

// Guarda junto al programa un .wasm independiente, que corre con wasmtime
const saveWasm = async (): Promise<void> => {
  const editor = activeKunturEditor();
  if (editor === null) {
    return;
  }
  const path = await savedFilePath(editor.document);
  if (path === null) {
    return;
  }
  const compiled = compile(editor.document.getText(), {language: currentLanguage(), target: 'wasi'});
  if (compiled.binary === null) {
    void vscode.window.showErrorMessage(`No se pudo compilar: ${compiled.diagnostics[0].message}`);
    return;
  }
  const output = vscode.Uri.file(path.replace(/\.kun$/, '') + '.wasm');
  await vscode.workspace.fs.writeFile(output, compiled.binary);
  const name = output.path.split('/').pop();
  void vscode.window.showInformationMessage(`Se guardó ${name} (${compiled.binary.length} bytes). Ejecútalo con: wasmtime ${name}`);
};

// Traduce el programa al otro idioma y cambia la configuración para que se revise en ese idioma
const translateFile = async (): Promise<void> => {
  const editor = activeKunturEditor();
  if (editor === null) {
    return;
  }
  let target: Language = 'qu';
  let setting = quechuaSetting;
  if (currentLanguage() === 'qu') {
    target = 'es';
    setting = spanishSetting;
  }
  const document = editor.document;
  const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
  await editor.edit((builder) => builder.replace(fullRange, translateSource(document.getText(), target)));
  let scope = vscode.ConfigurationTarget.Global;
  if (vscode.workspace.workspaceFolders !== undefined) {
    scope = vscode.ConfigurationTarget.Workspace;
  }
  await vscode.workspace.getConfiguration(settingsSection).update(languageSetting, setting, scope);
  void vscode.window.showInformationMessage(`El programa ahora está en ${setting}.`);
};

// Conecta la revisión de errores y los comandos cuando se abre un archivo de Kuntur
export const activate = (context: vscode.ExtensionContext): void => {
  const collection = vscode.languages.createDiagnosticCollection(languageId);
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  const refresh = (document: vscode.TextDocument): void => {
    if (document.languageId !== languageId) {
      return;
    }
    collection.set(document.uri, diagnosticsFor(document));
  };

  const scheduleRefresh = (document: vscode.TextDocument): void => {
    const key = document.uri.toString();
    clearTimeout(timers.get(key));
    timers.set(key, setTimeout(() => {
      timers.delete(key);
      refresh(document);
    }, refreshDelayMs));
  };

  context.subscriptions.push(
    collection,
    vscode.workspace.onDidOpenTextDocument(refresh),
    vscode.workspace.onDidChangeTextDocument((event) => scheduleRefresh(event.document)),
    vscode.workspace.onDidCloseTextDocument((document) => collection.delete(document.uri)),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(settingsSection)) {
        vscode.workspace.textDocuments.forEach(refresh);
      }
    }),
    vscode.commands.registerCommand('kuntur.ejecutar', () => runFile(context)),
    vscode.commands.registerCommand('kuntur.verWebAssembly', showWebAssembly),
    vscode.commands.registerCommand('kuntur.guardarWasm', saveWasm),
    vscode.commands.registerCommand('kuntur.traducir', translateFile),
  );
  vscode.workspace.textDocuments.forEach(refresh);
};

// No hay nada que liberar aparte de lo registrado en el contexto
export const deactivate = (): void => {};
