# Estándares de desarrollo

Kuntur — convenciones de ramas, commits y codificación.

---

## ESTÁNDARES DE RAMAS

| Rama | Uso |
|---|---|
| `main` | Versión estable |
| `develop` | Integración de los módulos terminados |
| `feature/<modulo>` | Desarrollo de un módulo o funcionalidad, en `snake_case` (ej. `feature/analizador_lexico`) |
| `fix/<tema>` | Corrección puntual sobre `develop` |
| `refactor/<tema>` | Reestructuración sin cambiar el comportamiento |
| `test/<tema>` | Pruebas nuevas o ajustes de pruebas |
| `docs/<tema>` | Documentación |

### Flujo

1. Cada módulo se desarrolla en su rama `feature/<modulo>`, creada desde `develop`.
2. Al terminarlo se abre un Pull Request hacia `develop`. Las pruebas de GitHub Actions deben pasar antes del merge.
3. Cuando `develop` reúne una fase completa, se abre un Pull Request de `develop` hacia `main`.
4. Después del merge, la rama de trabajo se borra.

---

## ESTÁNDARES DE COMMITS

Se usa Conventional Commits.

| Tipo | Uso |
|---|---|
| `feat` | Nueva funcionalidad del lenguaje, del compilador o del playground |
| `fix` | Corrección de errores |
| `style` | Cambios visuales o de formato sin afectar la lógica |
| `refactor` | Reestructuración sin modificar el comportamiento |
| `docs` | Documentación |
| `test` | Creación o actualización de pruebas |
| `chore` | Configuración, dependencias y flujos de CI |

### Formato

```
<tipo>: <Descripción>
```

### Reglas

- El mensaje comienza con mayúscula después del prefijo.
- Describe la funcionalidad, no los archivos modificados.
- Un commit representa una única funcionalidad, corrección o mejora.
- Evitar mensajes genéricos: `cambios`, `correcciones`, `actualización`.

---

## ESTÁNDARES DE CODIFICACIÓN

### Idioma

- El código fuente se escribe en inglés: módulos, funciones, variables, tipos y constantes.
- Las palabras clave del lenguaje Kuntur y los mensajes visibles para el usuario (errores, CLI, playground) quedan en español.

### Comentarios

- Cada función lleva un comentario de una línea, en español, que describe su propósito.
- Dentro de las funciones solo se dejan avisos importantes, también de una línea.
- No se deja código comentado.

```typescript
// Indica si el carácter puede iniciar un identificador
const isIdentifierStart = (char: string): boolean => /[\p{L}_]/u.test(char);
```

### Sintaxis

El formato se valida con ESLint (`npm run lint`).

- Punto y coma al final de cada sentencia.
- Comillas simples.
- Indentación de 2 espacios.
- No se usan operadores ternarios; se prefieren bloques `if`/`else`.
- `else` y `catch` en línea nueva, después de la llave de cierre.
- Literales de objeto sin espacios internos: `{line: 1, column: 4}`.
- `const` por defecto; `let` solo cuando el valor deba reasignarse.
- Se evitan valores mágicos: se declaran como constantes con nombre.
- Tipado explícito en las funciones exportadas.

---

## ARQUITECTURA DEL COMPILADOR

```
src/
├── lexer/          Texto fuente → tokens
├── parser/         Tokens → árbol de sintaxis (AST)
├── checker/        Revisión de nombres y tipos antes de ejecutar
├── interpreter/    Ejecución directa del AST
├── compiler/       Traducción a WebAssembly y funciones del anfitrión
│   └── wasm/       Codificación binaria y de texto de los módulos
├── errors/         Diagnósticos y sugerencias en español
├── index.ts        API pública: tokenize, parse, run
└── cli.ts          Ejecutable de línea de comandos
```

Cada etapa recibe la salida de la anterior y no conoce a las siguientes.

### Manejo de errores

- Las funciones públicas (`tokenize`, `parse`, `check`, `compile`, `run`, `runCompiled`) **no lanzan excepciones**: devuelven un objeto plano con su resultado y una lista de `diagnostics`.
- Todo diagnóstico indica la etapa, el mensaje en español, la línea y la columna.
- El lexer y el parser se recuperan del error y siguen analizando, para informar varios errores en una sola pasada.
- El análisis semántico reporta todos los errores que encuentra y los ordena por posición; tras un error, la expresión queda con tipo desconocido para no repetir avisos en cadena.
- Dentro del intérprete los errores de ejecución viajan como excepción interna y se convierten en diagnóstico en `run`.
- Los mensajes que comparten varias etapas viven en `src/errors/messages.ts`.
- El código compilado usa las mismas funciones propias y mensajes que el intérprete, a través de las funciones del anfitrión.

### Mensajes de error

Los mensajes están pensados para quien aprende a programar:

- Explican qué pasó con palabras simples, sin jerga del compilador.
- Mencionan el nombre o el símbolo involucrado entre comillas invertidas.
- Cuando es posible, sugieren la corrección (`¿Quisiste decir \`edad\`?`).

---

## PRUEBAS

- Se usa Vitest. Las pruebas viven en `tests/`, con la misma división que `src/`.
- Cada prueba lleva un comentario de una línea con lo que verifica y su nombre en español.
- Cada error nuevo del lenguaje se acompaña de una prueba que verifica su mensaje.
- Todo lo que se puede compilar se prueba en el intérprete y en WebAssembly, y la salida y los errores deben ser idénticos.
