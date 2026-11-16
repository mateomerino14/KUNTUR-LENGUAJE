# Extensión para VS Code

La carpeta `vscode/` tiene una extensión que lleva Kuntur a VS Code para los archivos `.kun`.

## Instalar

1. Descarga `kuntur.vsix` del [último release de la extensión](https://github.com/mateomerino14/KUNTUR-LENGUAJE/releases).
2. En VS Code abre **Extensiones** (`Ctrl + Shift + X`), presiona **...** arriba a la derecha y elige **Instalar desde VSIX...**.
3. Elige el archivo descargado. Al abrir un archivo `.kun`, la extensión se activa sola.

También se puede instalar desde la terminal: `code --install-extension kuntur.vsix`.

## Qué hace

| Función | Cómo se usa |
|---|---|
| Colores | Automático, en español y en quechua |
| Errores mientras escribes | Se subrayan en rojo; al pasar el mouse se ve el mensaje. En azul, lo que no se puede compilar a WebAssembly |
| Ejecutar | Botón ▶ de la esquina o `Ctrl + Enter`. Abre una terminal donde se responde a cada `leer`, y queda abierta para leer la salida |
| Fragmentos | Escribe `si`, `para`, `paracada`, `funcion`, `registro`... y presiona Tab |
| Ver el WebAssembly | `Ctrl + Shift + P` → *Kuntur: Ver el WebAssembly generado* |
| Guardar `.wasm` | `Ctrl + Shift + P` → *Kuntur: Guardar WebAssembly independiente (.wasm)* |
| Traducir | `Ctrl + Shift + P` → *Kuntur: Traducir entre español y quechua* |

La configuración `kuntur.idioma` elige si las palabras del lenguaje se revisan en `español` o en `runasimi`.

## Cómo está hecha

- La extensión usa el mismo compilador del repositorio: `esbuild` lo empaqueta junto con la extensión, así que no hace falta instalar Node ni Kuntur.
- Para ejecutar, abre una terminal propia que corre la línea de comandos de Kuntur con el Node que trae VS Code. La terminal muestra lo que se escribe, entrega cada línea a `leer` y queda abierta al terminar.
- Los colores vienen de una gramática TextMate (`vscode/syntaxes/kuntur.tmLanguage.json`).

## Desarrollo

```bash
npm run vscode:build     # Empaqueta la extensión en vscode/dist
npm run vscode:test      # Descarga VS Code y prueba la extensión dentro de él (en Linux sin pantalla: xvfb-run -a npm run vscode:test)
npm run vscode:package   # Genera vscode/kuntur.vsix
```

Las pruebas de `tests/vscode` revisan la gramática de colores, el rango que se subraya y la terminal. `vscode/test/suite.cjs` prueba la extensión dentro de un VS Code real: errores, comandos, traducción y ejecución con `leer`. En cada cambio a `main` se publica el `.vsix` en un release.
