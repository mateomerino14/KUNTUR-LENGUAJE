// Descarga VS Code y ejecuta las pruebas de la extensión dentro de él
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {runTests} from '@vscode/test-electron';

const extensionDevelopmentPath = path.resolve(fileURLToPath(import.meta.url), '../..');
const extensionTestsPath = path.join(extensionDevelopmentPath, 'test', 'suite.cjs');

try {
  await runTests({
    extensionDevelopmentPath,
    extensionTestsPath,
    launchArgs: ['--disable-extensions', '--disable-workspace-trust'],
  });
}
catch {
  console.error('Las pruebas de la extensión fallaron.');
  process.exit(1);
}
