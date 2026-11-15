# Kuntur

Lenguaje de programación en español, pensado para aprender cómo funciona un compilador y para enseñar a programar con mensajes de error claros.

```
funcion factorial(n: entero): entero {
    si n <= 1 {
        retornar 1
    }
    retornar n * factorial(n - 1)
}

para i desde 1 hasta 5 {
    mostrar(texto(i) + "! =", factorial(i))
}
```

```
Error de ejecución en la línea 4, columna 27:
  4 | var mensaje = "Tienes " + edda + " años"
    |                           ^
`edda` no existe. ¿Quisiste decir `edad`?
```

## Cómo funciona

```
código fuente ──► analizador léxico ──► analizador sintáctico ──► intérprete
                     (tokens)              (árbol de sintaxis)
```

1. **Analizador léxico** (`src/lexer`): corta el texto en tokens y decide dónde termina cada sentencia según los saltos de línea.
2. **Analizador sintáctico** (`src/parser`): arma el árbol de sintaxis con un parser descendente recursivo y el método de Pratt para la precedencia de los operadores. Se recupera de los errores para informar varios en una sola pasada.
3. **Intérprete** (`src/interpreter`): recorre el árbol y ejecuta el programa, con ámbitos, clausuras y límites contra ciclos infinitos.

## Requisitos

- Node.js 22.12 o superior

## Instalación

```bash
npm install
```

## Uso

```bash
npm run kuntur ejemplos/factorial.kun            # Ejecuta un programa
npm run kuntur -- --tokens ejemplos/hola.kun     # Muestra los tokens
npm run kuntur -- --arbol ejemplos/hola.kun      # Muestra el árbol de sintaxis
```

También como biblioteca:

```typescript
import {run, formatDiagnostic} from 'kuntur';

const source = 'mostrar("Hola")';
const {output, diagnostics} = run(source);
diagnostics.forEach((diagnostic) => console.error(formatDiagnostic(diagnostic, source)));
```

## Comandos

| Comando | Uso |
|---|---|
| `npm test` | Corre las pruebas |
| `npm run lint` | Valida el estilo del código |
| `npm run typecheck` | Verifica los tipos de TypeScript |
| `npm run build` | Compila a `dist/` |

## Documentación

- [Referencia del lenguaje](docs/lenguaje.md)
- [Estándares de desarrollo](reglas.md)
- [Programas de ejemplo](ejemplos/)

## Hoja de ruta

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Analizador léxico, analizador sintáctico e intérprete | Terminada |
| 2 | Tipos (`entero`, `decimal`, `texto`, `logico`), análisis semántico y errores antes de ejecutar | Pendiente |
| 3 | Generación de WebAssembly | Pendiente |
| 4 | Playground web con visualización de tokens, árbol y ejecución paso a paso | Pendiente |
