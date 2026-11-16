# Kuntur para VS Code

Soporte para [Kuntur](https://github.com/mateomerino14/KUNTUR-LENGUAJE), un lenguaje de programación en español, en archivos `.kun`.

## Qué incluye

- **Colores** para las palabras del lenguaje, en español y en quechua.
- **Errores mientras escribes:** el mismo análisis del compilador subraya los errores de sintaxis y de tipos, con el mensaje completo al pasar el mouse. También avisa lo que todavía no se puede compilar a WebAssembly.
- **Ejecutar** con el botón ▶ de la esquina o con `Ctrl + Enter`. El programa corre en la terminal, así que se puede responder a cada `leer`.
- **Fragmentos** para escribir rápido: `si`, `sisino`, `mientras`, `para`, `paracada`, `funcion`, `registro`, y en quechua `sichus`, `kaykama`, `sapanka`, `ruray`.
- **Comandos** (`Ctrl + Shift + P`, luego "Kuntur"):
  - *Ver el WebAssembly generado*: abre al lado el módulo en formato de texto.
  - *Guardar WebAssembly independiente (.wasm)*: lo guarda junto al programa para correrlo con `wasmtime`.
  - *Traducir entre español y quechua*: traduce las palabras del lenguaje y cambia el idioma de la configuración.

## Modo quechua

En la configuración, `kuntur.idioma` elige el idioma de las palabras del lenguaje: `español` o `runasimi`. Ver el [vocabulario](https://github.com/mateomerino14/KUNTUR-LENGUAJE/blob/main/docs/quechua.md).

No hace falta instalar nada más: la extensión trae el compilador y usa el Node que viene con VS Code.
