# Compilación a WebAssembly

Además de interpretarlo, Kuntur puede traducir un programa a **WebAssembly**, el formato binario que ejecutan los navegadores y Node.js casi a la velocidad del código nativo. El compilador escribe el archivo `.wasm` byte por byte, sin bibliotecas externas, y también lo muestra en el formato de texto `.wat` para poder leerlo.

```bash
npm run kuntur -- --wasm ejemplos/tipos.kun                 # Compila y ejecuta
npm run kuntur -- --wat ejemplos/hola.kun                   # Muestra el WebAssembly generado
npm run kuntur -- --compilar ejemplos/tipos.kun tipos.wasm  # Guarda el binario
```

## Etapas

```
árbol de sintaxis + tipos ──► generador de código ──► módulo ──► binario .wasm
                                (src/compiler)                └─► texto .wat
```

1. El **análisis semántico** guarda el tipo de cada expresión, variable, función y ciclo.
2. El **generador de código** (`src/compiler/codegen.ts`) recorre el árbol y produce instrucciones de WebAssembly para cada función.
3. El **codificador** (`src/compiler/wasm/`) arma el módulo con sus secciones (tipos, importaciones, funciones, memoria, variables globales, exportaciones, código y datos) y lo escribe en binario o en texto.
4. El **ejecutor** (`src/compiler/runner.ts`) instancia el módulo con las funciones del anfitrión y llama a `principal`.

## Cómo se representan los valores

| Kuntur | WebAssembly | Por qué |
|---|---|---|
| `entero`, `decimal` | `f64` | Igual que en el intérprete, para que los resultados sean idénticos |
| `logico` | `i32` | `1` es verdadero y `0` es falso |
| `texto`, `lista de ...` | `externref` | Son valores de JavaScript; WebAssembly solo guarda la referencia |

Los textos y las listas viven en JavaScript, y WebAssembly los maneja llamando a **funciones del anfitrión** (`src/compiler/host.ts`): unir textos, leer una posición, agregar a una lista, convertir a texto... Así el código compilado no necesita un recolector de basura propio. Los textos escritos en el programa se guardan en la memoria del módulo y el anfitrión los lee la primera vez que se usan.

Las funciones del anfitrión reutilizan las del intérprete, de modo que **los mensajes de error son los mismos**, con la misma línea y columna.

## Cómo se traduce cada parte

**Variables.** Las del nivel superior son variables globales del módulo; las de bloques y funciones son variables locales.

**Programa principal.** Las sentencias del nivel superior forman la función `principal`, que se exporta junto con la memoria.

**Condicionales.** `si` se traduce a `if`/`else`; `sino si` queda como un `if` dentro del `else`.

**Ciclos.** `mientras` y `para` son un `block` (para salir con `romper`) con un `loop` adentro, y otro `block` interno para `continuar`. El `para` calcula cada valor como `desde + vuelta × paso`, igual que el intérprete, para no acumular errores con decimales:

```wat
block                      ;; salida del ciclo (romper)
  loop                     ;; vuelta
    local.get $i_desde
    local.get $i_vuelta
    local.get $i_paso
    f64.mul
    f64.add
    local.set $i           ;; i = desde + vuelta * paso
    ...                    ;; si ya pasó el final: br_if 1
    block                  ;; destino de continuar
      ...                  ;; cuerpo del ciclo
    end
    ...                    ;; vuelta = vuelta + 1
    br 0
  end
end
```

**Residuo.** WebAssembly no tiene residuo para `f64`, así que `a % b` se calcula como `a - b × trunc(a / b)`, que da lo mismo que en JavaScript.

**Límites.** Cada vuelta de un ciclo llama a `contar_paso` y cada llamada a una función pasa por `entrar_llamada` y `salir_llamada`. Así un ciclo infinito o una recursión sin fin se detienen con el mismo mensaje que en el intérprete.

## Qué se puede compilar

Se compila todo programa cuyos tipos se conozcan antes de ejecutar. El compilador pide lo que falte:

| Necesita | Ejemplo |
|---|---|
| Tipo en cada parámetro | `funcion doble(n: entero)` |
| Tipo de retorno si la función retorna un valor | `funcion doble(n: entero): entero` |
| Tipo de los elementos de las listas vacías | `var nombres: lista de texto = []` |
| Valor inicial o tipo en cada variable | `var x: entero = 0` en lugar de `var x` |

Todavía no se compilan:

- Funciones declaradas dentro de otras funciones o de bloques.
- Funciones usadas como valor, sin llamarlas.
- `nulo`, salvo para comparar con `==` o `!=`.

Estos programas se pueden seguir ejecutando con el intérprete.

## Rendimiento

En una prueba con `fib(27)` y un ciclo de 3 millones de vueltas, el programa compilado tardó unos 50 ms y el intérprete unos 750 ms: alrededor de 15 veces más rápido, con la misma salida.

## Cómo se prueba

Las pruebas de `tests/compiler/compiler.test.ts` ejecutan cada programa **en el intérprete y compilado**, y exigen que la salida y los errores sean idénticos. Cubren los ejemplos, las operaciones, los textos, las listas, los ciclos, las funciones y cada error de ejecución.
