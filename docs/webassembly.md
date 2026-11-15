# Compilación a WebAssembly

Además de interpretarlo, Kuntur puede traducir un programa a **WebAssembly**, el formato binario que ejecutan los navegadores y Node.js casi a la velocidad del código nativo. El compilador escribe el archivo `.wasm` byte por byte, sin bibliotecas externas, y también lo muestra en el formato de texto `.wat` para poder leerlo.

Hay dos versiones del módulo:

| Versión | Dónde corre | Textos y listas |
|---|---|---|
| Para el navegador | Dentro de JavaScript (playground, `--wasm`) | Viven en JavaScript (`externref`) |
| Independiente (WASI) | En cualquier computadora con `wasmtime`, sin JavaScript | Viven en la memoria del propio módulo |

```bash
npm run kuntur -- --wasm ejemplos/tipos.kun                 # Versión para el navegador: compila y ejecuta
npm run kuntur -- --wat ejemplos/hola.kun                   # Muestra el WebAssembly generado
npm run kuntur -- --wasi ejemplos/tipos.kun                 # Versión independiente: compila y ejecuta
npm run kuntur -- --compilar ejemplos/tipos.kun tipos.wasm  # Guarda la versión independiente
wasmtime tipos.wasm                                         # La ejecuta sin Node ni Kuntur
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

**Residuo.** WebAssembly no tiene residuo para `f64`, así que `a % b` se calcula como `a - b × trunc(a / b)`, la misma definición que usa JavaScript. Con decimales muy grandes o muy pequeños el redondeo puede diferir en el último dígito.

**Variables globales usadas por funciones.** Una función se puede llamar antes de la línea que declara una variable global que usa. Para fallar igual que el intérprete, esas variables tienen una marca `<nombre>_declarada` que se revisa al leerlas o asignarlas dentro de una función.

**Límites.** Cada vuelta de un ciclo llama a `contar_paso` y cada llamada a una función pasa por `entrar_llamada` y `salir_llamada`. Así un ciclo infinito o una recursión sin fin se detienen con el mismo mensaje que en el intérprete.

## Qué se puede compilar

Se compila todo programa cuyos tipos se conozcan antes de ejecutar. El compilador pide lo que falte:

| Necesita | Ejemplo |
|---|---|
| Tipo en cada parámetro | `funcion doble(n: entero)` |
| Tipo de retorno si la función retorna un valor | `funcion doble(n: entero): entero` |
| Tipo de los elementos de las listas vacías | `var nombres: lista de texto = []` |
| Valor inicial o tipo en cada variable | `var x: entero = 0` en lugar de `var x` |

`leer` también se compila: llama a la función del anfitrión `read_line`, que pide la línea a la terminal o al cuadro de entrada del playground.

Todavía no se compilan:

- Funciones declaradas dentro de otras funciones o de bloques.
- Funciones usadas como valor, sin llamarlas.
- `nulo`, salvo para comparar con `==` o `!=`.

Estos programas se pueden seguir ejecutando con el intérprete.

## Versión independiente (WASI)

**WASI** es el estándar con el que WebAssembly habla con el sistema. La versión independiente solo importa cinco funciones de WASI: escribir (`fd_write`), leer (`fd_read`), saber si la entrada es una terminal (`fd_fdstat_get`), pedir bytes al azar (`random_get`) y terminar (`proc_exit`). Exporta `_start` y `memory`, como espera cualquier ejecutor.

### El runtime

Todo lo que en el navegador hace JavaScript lo hace una biblioteca escrita en WebAssembly (`src/compiler/wasi/runtime.ts`), con las **mismas funciones y firmas** que el anfitrión, cambiando las referencias por direcciones de memoria. Por eso el generador de código es el mismo para las dos versiones: solo cambia a quién llama.

El runtime está escrito en el formato de texto anidado de WebAssembly, y un ensamblador propio (`src/compiler/wasm/assembler.ts`) lo convierte en instrucciones.

### Los objetos en memoria

Cada objeto empieza con una etiqueta que dice su tipo, así el runtime puede compararlos y mostrarlos sin conocer los tipos del programa:

| Objeto | Diseño |
|---|---|
| Número | etiqueta 1, y el `f64` en el byte 8 |
| Texto | etiqueta 2, largo en bytes y los bytes en UTF-8 |
| Lista | etiqueta 3, largo, capacidad y dirección de sus elementos; cada elemento es la dirección de un objeto |
| Lógico | etiqueta 4 y su valor; solo existen dos, fijos en memoria |

Los textos escritos en el programa se guardan ya con su etiqueta en la sección de datos, así que no se copian al usarlos. La memoria se reserva hacia adelante y crece con `memory.grow`; no hay recolector de basura, así que nunca se libera mientras el programa corre.

### Los mensajes de error

Los errores se escriben en la salida de errores con el mismo formato que la línea de comandos, y el programa termina con código 1. Los mensajes no se copian a mano: el runtime los arma con las funciones de `src/errors/messages.ts`, las mismas del intérprete, pidiéndolos con marcas en lugar de sus partes variables.

### Los decimales, igual que JavaScript

JavaScript escribe cada número con la menor cantidad de cifras que, leídas de nuevo, dan el mismo valor (`0.1 + 0.2` es `0.30000000000000004`). Para lograrlo sin JavaScript, el runtime:

1. Prueba con 1, 2, 3... hasta 17 cifras.
2. Calcula las cifras con el producto exacto `a × 10^s` en **doble precisión**: un número como la suma de dos `f64`, con la técnica de Dekker, para no perder las cifras 16 y 17.
3. Acepta la primera cantidad de cifras cuyo error es menor que la mitad de la distancia al número vecino. En un empate exacto, la acepta solo si el número es par, como hace la lectura de JavaScript.
4. Escribe el resultado con las reglas de `Number.prototype.toString`: notación normal hasta 21 cifras y exponencial (`1e+21`, `1e-7`) fuera de ese rango.

`numero()` hace el camino inverso con la misma doble precisión. Una prueba con 15 000 números de magnitudes muy distintas dio el mismo texto que JavaScript en todos.

### Diferencias conocidas

- `longitud` y las posiciones de un texto cuentan como JavaScript (los emojis ocupan dos), pero leer la segunda mitad de un emoji devuelve el emoji completo.
- Sin recolector de basura, un programa que crea muchísimos textos puede quedarse sin memoria; entonces termina con un error propio.

## Rendimiento

En una prueba con `fib(27)` y un ciclo de 3 millones de vueltas, el programa compilado tardó unos 50 ms y el intérprete unos 750 ms: alrededor de 15 veces más rápido, con la misma salida.

## Cómo se prueba

Las pruebas de `tests/compiler/compiler.test.ts` ejecutan cada programa **en el intérprete y compilado**, y exigen que la salida y los errores sean idénticos. Cubren los ejemplos, las operaciones, los textos, las listas, los ciclos, las funciones y cada error de ejecución.

`tests/compiler/wasi.test.ts` hace lo mismo con la versión independiente, ejecutándola con el WASI de Node: compara lo que se ve en la terminal, la salida de errores y el código de salida. Además, la versión independiente se probó con **wasmtime**, que no usa JavaScript, y su `.wat` es válido según `wabt`.
