export interface LineEditorResult {
  echo: string;
  lines: string[];
  interrupt: boolean;
  endOfInput: boolean;
}

const enter = '\r';
const newline = '\n';
const backspace = '\x7f';
const controlC = '\x03';
const controlD = '\x04';
const escape = '\x1b';

// Arma las líneas que se escriben en la terminal: muestra cada letra, borra con retroceso y entrega la línea al presionar Enter
export class LineEditor {
  private line = '';

  // Procesa lo que llegó del teclado y devuelve qué mostrar y qué líneas quedaron completas
  input(data: string): LineEditorResult {
    const result: LineEditorResult = {echo: '', lines: [], interrupt: false, endOfInput: false};
    if (data.startsWith(escape)) {
      // Flechas y otras teclas especiales no editan la línea
      return result;
    }
    for (const char of data) {
      if (char === enter || char === newline) {
        result.lines.push(this.line);
        result.echo += '\r\n';
        this.line = '';
      }
      else if (char === backspace) {
        const chars = [...this.line];
        if (chars.length > 0) {
          chars.pop();
          this.line = chars.join('');
          result.echo += '\b \b';
        }
      }
      else if (char === controlC) {
        result.interrupt = true;
        result.echo += '^C\r\n';
      }
      else if (char === controlD) {
        result.endOfInput = true;
      }
      else if (char >= ' ') {
        this.line += char;
        result.echo += char;
      }
    }
    return result;
  }
}

// Adapta los saltos de línea del programa a los que espera la terminal
export const toTerminalText = (text: string): string => text.replace(/\r?\n/g, '\r\n');
