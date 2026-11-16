import {spawn, type ChildProcess} from 'node:child_process';
import * as vscode from 'vscode';
import {LineEditor, toTerminalText} from './lineEditor.js';

const red = '\x1b[31m';
const dim = '\x1b[2m';
const reset = '\x1b[0m';

// Terminal propia que ejecuta un programa de Kuntur y queda abierta al terminar, para leer la salida con calma
export const createProgramTerminal = (args: string[], onExit: (code: number | null) => void): vscode.Pseudoterminal => {
  const writeEmitter = new vscode.EventEmitter<string>();
  const editor = new LineEditor();
  let child: ChildProcess | null = null;

  const write = (text: string): void => writeEmitter.fire(text);

  return {
    onDidWrite: writeEmitter.event,
    open: () => {
      child = spawn(process.execPath, args, {env: {...process.env, ELECTRON_RUN_AS_NODE: '1', KUNTUR_ECO: '0'}});
      child.stdout?.setEncoding('utf8');
      child.stderr?.setEncoding('utf8');
      child.stdout?.on('data', (text: string) => write(toTerminalText(text)));
      child.stderr?.on('data', (text: string) => write(`${red}${toTerminalText(text)}${reset}`));
      child.on('close', (code) => {
        child = null;
        let message = 'El programa terminó.';
        if (code !== 0) {
          message = 'El programa terminó con un error.';
        }
        write(`\r\n${dim}${message}${reset}\r\n`);
        onExit(code);
      });
    },
    handleInput: (data) => {
      if (child === null) {
        return;
      }
      const result = editor.input(data);
      write(result.echo);
      for (const line of result.lines) {
        child.stdin?.write(`${line}\n`);
      }
      if (result.endOfInput) {
        child.stdin?.end();
      }
      if (result.interrupt) {
        child.kill();
      }
    },
    close: () => {
      child?.kill();
    },
  };
};
