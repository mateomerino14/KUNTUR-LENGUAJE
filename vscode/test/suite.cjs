// Pruebas dentro de un VS Code real: errores, comandos y traducción sobre un archivo .kun
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vscode = require('vscode');

const waitFor = async (condition, message) => {
  for (let attempt = 0; attempt < 100; attempt++) {
    const value = condition();
    if (value) {
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Se esperaba: ${message}`);
};

const openProgram = async (name, source) => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'kuntur-')), name);
  fs.writeFileSync(file, source);
  const document = await vscode.workspace.openTextDocument(file);
  await vscode.window.showTextDocument(document);
  return document;
};

const tests = {
  'reconoce los archivos .kun': async () => {
    const document = await openProgram('hola.kun', 'mostrar("hola")\n');
    assert.equal(document.languageId, 'kuntur');
  },
  'subraya los errores mientras se escribe': async () => {
    const document = await openProgram('error.kun', 'var edad = 20\nmostrar(edda)\n');
    const diagnostics = await waitFor(() => {
      const found = vscode.languages.getDiagnostics(document.uri);
      return found.length > 0 && found;
    }, 'un error en el archivo');
    assert.equal(diagnostics[0].message, '`edda` no existe. ¿Quisiste decir `edad`?');
    assert.deepEqual([diagnostics[0].range.start.line, diagnostics[0].range.start.character, diagnostics[0].range.end.character], [1, 8, 12]);
    const editor = vscode.window.activeTextEditor;
    await editor.edit((builder) => builder.replace(diagnostics[0].range, 'edad'));
    await waitFor(() => vscode.languages.getDiagnostics(document.uri).length === 0, 'que el error desaparezca al corregirlo');
  },
  'muestra el WebAssembly generado': async () => {
    await openProgram('wat.kun', 'mostrar(1 + 2)\n');
    await vscode.commands.executeCommand('kuntur.verWebAssembly');
    const editor = await waitFor(() => vscode.window.visibleTextEditors.find((candidate) => candidate.document.languageId === 'wat'), 'el WebAssembly abierto');
    assert.match(editor.document.getText(), /\(module/);
  },
  'guarda el WebAssembly independiente': async () => {
    const document = await openProgram('guardar.kun', 'mostrar("hola")\n');
    await vscode.commands.executeCommand('kuntur.guardarWasm');
    const output = document.uri.fsPath.replace(/\.kun$/, '.wasm');
    await waitFor(() => fs.existsSync(output), 'el archivo .wasm');
    assert.deepEqual([...fs.readFileSync(output).subarray(0, 4)], [0, 97, 115, 109]);
  },
  'traduce a quechua y revisa en quechua': async () => {
    const document = await openProgram('traducir.kun', 'si verdadero {\n  mostrar(1)\n}\n');
    await vscode.commands.executeCommand('kuntur.traducir');
    assert.equal(document.getText(), 'sichus cheqaq {\n  rikuchiy(1)\n}\n');
    assert.equal(vscode.workspace.getConfiguration('kuntur').get('idioma'), 'runasimi');
    await new Promise((resolve) => setTimeout(resolve, 600));
    assert.equal(vscode.languages.getDiagnostics(document.uri).length, 0);
    await vscode.commands.executeCommand('kuntur.traducir');
    assert.equal(document.getText(), 'si verdadero {\n  mostrar(1)\n}\n');
  },
  'ejecuta el archivo en una terminal': async () => {
    await openProgram('ejecutar.kun', 'mostrar("hola")\n');
    const code = await vscode.commands.executeCommand('kuntur.ejecutar');
    assert.equal(code, 0);
    assert.ok(vscode.window.terminals.some((terminal) => terminal.name === 'Kuntur'), 'la terminal sigue abierta para leer la salida');
  },
  'termina con error si el programa falla': async () => {
    await openProgram('falla.kun', 'var cero = 0\nmostrar(1 / cero)\n');
    assert.equal(await vscode.commands.executeCommand('kuntur.ejecutar'), 1);
  },
  'responde a leer desde la terminal': async () => {
    await openProgram('leer.kun', 'var nombre = leer("Nombre: ")\nsi nombre != "Ana" {\n  mostrar(1 / 0)\n}\n');
    const running = vscode.commands.executeCommand('kuntur.ejecutar');
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const terminal = vscode.window.terminals.filter((candidate) => candidate.name === 'Kuntur').at(-1);
    terminal.sendText('Ana');
    assert.equal(await running, 0);
  },
};

exports.run = async () => {
  const failures = [];
  for (const [name, test] of Object.entries(tests)) {
    try {
      await test();
      console.log(`✓ ${name}`);
    }
    catch (error) {
      failures.push(name);
      console.log(`✗ ${name}\n  ${error.message}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(`${failures.length} pruebas fallaron`);
  }
};
