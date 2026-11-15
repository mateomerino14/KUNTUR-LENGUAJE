# Referencia del lenguaje Kuntur

Kuntur es un lenguaje pequeño, con palabras clave en español. Esta referencia describe lo que funciona en la versión actual (fase 3: compilación a WebAssembly). Los programas se pueden interpretar o [compilar a WebAssembly](webassembly.md).

## Estructura de un programa

Un programa es una lista de sentencias. Cada sentencia va en su propia línea; también se pueden separar con `;`.

```
var nombre = "Kuntur"
mostrar("Hola, " + nombre)
```

Una expresión puede seguir en la línea siguiente si la línea termina en un operador, o si está dentro de paréntesis o corchetes:

```
var total = precio +
    impuesto

var colores = [
    "rojo",
    "amarillo",
    "verde",
]
```

Los comentarios empiezan con `//` y llegan hasta el final de la línea.

## Valores

| Tipo | Ejemplos |
|---|---|
| entero | `42`, `-7` |
| decimal | `3.14`, `2.0` |
| texto | `"hola"`, `"línea\nnueva"` |
| lógico | `verdadero`, `falso` |
| nulo | `nulo` |
| lista | `[1, 2, 3]`, `["a", verdadero, [1]]` |
| función | toda función declarada con `funcion` |

Los textos van entre comillas dobles y admiten `\n`, `\t`, `\"` y `\\`.

## Variables y constantes

```
var edad = 20
var apodo            // empieza en nulo
constante PI = 3.1416
```

- Antes de usar una variable hay que declararla con `var`.
- Una constante necesita valor inicial y no se puede cambiar.
- Los nombres pueden llevar tildes y `ñ`, pero no pueden empezar con un número.

## Tipos

Kuntur revisa los tipos **antes de ejecutar**: si hay un error, el programa no llega a correr y se muestran todos los errores juntos.

| Tipo | Se escribe | Valor inicial de ejemplo |
|---|---|---|
| Entero | `entero` | `0` |
| Decimal | `decimal` | `0.0` |
| Texto | `texto` | `""` |
| Lógico | `logico` o `lógico` | `falso` |
| Lista | `lista de entero`, `lista de lista de texto`... | `[]` |
| Diccionario | `diccionario de entero`, `diccionario de lista de texto`... | `{}` |
| Registro | El nombre del registro, por ejemplo `Alumno` | `Alumno("Ana", 85)` |

### Tipos anotados y deducidos

```
var edad: entero = 20        // tipo anotado
var nombre = "Ana"           // tipo deducido: texto
var promedio = 0.0           // tipo deducido: decimal
var notas = [70, 85]         // tipo deducido: lista de entero
var x                        // sin tipo: acepta cualquier valor
```

- Si una variable no tiene anotación, toma el tipo de su valor inicial y lo conserva: después de `var nombre = "Ana"`, `nombre = 5` es un error.
- Una variable con tipo anotado necesita un valor inicial.
- `var x` sin valor inicial, o iniciada con `nulo`, no tiene tipo y acepta cualquier valor.

### Enteros y decimales

- Un número escrito con punto es decimal, aunque valga lo mismo que un entero: `2.0` es decimal.
- Un entero se puede guardar donde se espera un decimal, pero no al revés: se perdería la parte decimal. Para convertir, usa `redondear()`.
- `+`, `-`, `*` y `%` entre enteros dan un entero; si interviene un decimal, dan un decimal.
- `/` siempre da un decimal: `7 / 2` es `3.5`.

Un caso típico es empezar un acumulador en `0` y luego guardar un decimal:

```
var promedio = 0
promedio = 7 / 2     // error: promedio es de tipo entero
```

La solución es empezar con `0.0` o declararla con `var promedio: decimal = 0`.

### Listas

Los elementos de una lista con tipo deben coincidir con él; una lista vacía `[]` sirve para cualquier lista.

```
var nombres: lista de texto = []
agregar(nombres, "Ana")
agregar(nombres, 42)         // error: esta lista es de texto
```

Una lista escrita con elementos de tipos distintos, como `[1, "a"]`, no tiene tipo de elemento y acepta cualquier valor.

### Funciones con tipos

```
funcion promedio(notas: lista de entero): decimal {
    ...
}
```

- Los argumentos se revisan contra los tipos de los parámetros.
- Si la función declara un tipo de retorno, cada `retornar` debe devolver ese tipo y **todos los caminos** deben llegar a un `retornar`, incluido el del `sino`.
- Los parámetros sin tipo aceptan cualquier valor; sus errores aparecen recién al ejecutar.

## Operadores

De mayor a menor precedencia:

| Operadores | Significado |
|---|---|
| `f(x)`, `lista[i]` | Llamada y acceso por posición |
| `-x` | Cambio de signo |
| `*`, `/`, `%` | Multiplicación, división y residuo |
| `+`, `-` | Suma (o unión de textos y listas) y resta |
| `<`, `<=`, `>`, `>=` | Comparación de números o de textos |
| `==`, `!=` | Igualdad y diferencia |
| `no` | Negación |
| `y` | Las dos condiciones son verdaderas |
| `o` | Al menos una condición es verdadera |
| `=` | Asignación |

- `no x == 5` se lee como `no (x == 5)`.
- `y` y `o` no evalúan la derecha si la izquierda ya decide el resultado.
- Las condiciones y los operadores lógicos solo aceptan `verdadero` o `falso`; no hay valores "parecidos a verdadero".
- Sumar un texto con cualquier valor los une como texto: `"Edad: " + 20`.
- Comparar con `==` valores de tipos distintos, como `"5" == 5`, es un error porque siempre daría falso; `nulo` se puede comparar con cualquier valor.

## Condicionales

```
si nota >= 51 {
    mostrar("Aprobado")
}
sino si nota >= 40 {
    mostrar("Segunda instancia")
}
sino {
    mostrar("Reprobado")
}
```

## Ciclos

```
mientras saldo > 0 {
    saldo = saldo - 10
}

para i desde 1 hasta 10 {
    mostrar(i)
}

para i desde 10 hasta 0 paso -2 {
    mostrar(i)          // 10, 8, 6, 4, 2, 0
}
```

- `para` incluye ambos límites.
- Sin `paso`, avanza de uno en uno. Para contar hacia abajo hay que indicar un `paso` negativo; si el inicio es mayor que el fin y no hay paso, el ciclo no da ninguna vuelta.
- La variable del `para` no se puede modificar dentro del ciclo.

`para cada` recorre los elementos de una lista, los caracteres de un texto o las claves de un diccionario:

```
para cada nota en [70, 85, 40] {
    mostrar(nota)
}
```

- Recorre hasta el largo que tenía la lista al empezar: lo que se agrega durante el ciclo no se recorre, y si la lista se acorta, el ciclo termina antes.
- La variable toma el tipo de los elementos y no se puede modificar.
- `cada` y `en` solo son especiales justo después de `para`; en otros lugares se pueden usar como nombres.
- `romper` sale del ciclo y `continuar` pasa a la siguiente vuelta.

## Funciones

```
funcion area(base, altura) {
    retornar base * altura / 2
}

mostrar(area(4, 3))
```

- Una función se puede llamar antes de la línea donde se declara.
- Sin `retornar`, una función devuelve `nulo`.
- Las funciones recuerdan las variables del lugar donde se declararon (clausuras).

## Listas

```
var notas = [70, 85, 40]
notas[2] = 55
agregar(notas, 90)
mostrar(notas[0], longitud(notas))
```

Las posiciones empiezan en 0. Los textos también se leen por posición (`"hola"[0]`), pero no se pueden modificar.

## Diccionarios

Un diccionario guarda valores por nombre. Las claves siempre son textos:

```
var edades = {"Ana": 20, "Luis": 18}
edades["Eva"] = 22          // agrega una clave
edades["Ana"] = 21          // cambia un valor
mostrar(edades["Luis"], longitud(edades))
mostrar(tiene(edades, "Juan"))   // falso
para cada nombre en edades {
    mostrar(nombre, edades[nombre])
}
```

- Las claves se recorren y se muestran en el orden en que se agregaron.
- Leer una clave que no existe es un error; para evitarlo se revisa antes con `tiene`.
- Un diccionario vacío necesita su tipo: `var precios: diccionario de decimal = {}`.
- Dos diccionarios son iguales si tienen las mismas claves con los mismos valores, sin importar el orden.

## Registros

Un registro agrupa datos con nombre propio, como una ficha:

```
registro Alumno {
    nombre: texto
    nota: entero
}

var a = Alumno("Ana", 85)
a.nota = a.nota + 5
mostrar(a.nombre, a.nota)   // Ana 90
mostrar(a)                  // Alumno(nombre: "Ana", nota: 90)
```

- Se crea llamando al registro con un valor por campo, en el orden en que se declararon.
- Cada campo tiene un tipo, y el registro es un tipo más: `lista de Alumno`, un parámetro `alumno: Alumno` o un campo de otro registro.
- Se declaran en el programa principal, fuera de funciones y bloques, y se pueden usar antes de la línea donde se declaran.
- Los campos también se pueden separar con comas en una sola línea: `registro Punto { x: decimal, y_: decimal }`.
- `tipo(a)` devuelve el nombre del registro, `"Alumno"`.

## Funciones propias

| Función | Descripción |
|---|---|
| `mostrar(a, b, ...)` | Muestra los valores en una línea, separados por un espacio |
| `longitud(x)` | Cantidad de elementos de una lista, de caracteres de un texto o de claves de un diccionario |
| `agregar(lista, valor)` | Agrega un valor al final de la lista |
| `quitar(lista)` | Quita y devuelve el último elemento |
| `tiene(diccionario, clave)` | Indica si el diccionario tiene la clave |
| `claves(diccionario)` | Lista con las claves, en el orden en que se agregaron |
| `texto(x)` | Convierte un valor en texto |
| `numero(x)` | Convierte un texto como `"42"` en decimal |
| `tipo(x)` | Devuelve el nombre del tipo al ejecutar: `"número"`, `"texto"`, `"lista"`... |
| `redondear(x)` | Redondea al entero más cercano |
| `raiz(x)` | Raíz cuadrada |
| `aleatorio(min, max)` | Entero al azar entre `min` y `max`, ambos incluidos |
| `leer(pregunta)` | Muestra la pregunta y devuelve, como texto, la línea que se escribe |

Sus nombres se pueden usar para variables propias (`var texto = "hola"`); en ese caso la variable tapa a la función dentro de su bloque.

## Leer datos

`leer` muestra una pregunta y espera una línea. Siempre devuelve un texto; para usarlo como número se convierte con `numero`:

```
var nombre = leer("¿Cómo te llamas? ")
var edad = numero(leer("¿Cuántos años tienes? "))
mostrar("Hola,", nombre + ". En 10 años tendrás", edad + 10)
```

- En la **terminal** se escribe cada respuesta y se presiona Enter. También se pueden pasar todas desde un archivo: `npm run kuntur ejemplos/promedio.kun < ejemplos/promedio.entrada`.
- En el **playground**, las respuestas se escriben de antemano en el cuadro Entrada, una por línea: cada `leer` usa la siguiente. La salida muestra la conversación completa, con las respuestas resaltadas.
- Si el programa pide más datos de los que hay, se detiene con un error en la línea del `leer`.
- Para guardar el dato en un `entero`, hay que redondearlo: `redondear(numero(leer("...")))`.

## Palabras reservadas

`var`, `constante`, `funcion` (o `función`), `retornar`, `si`, `sino`, `mientras`, `para`, `desde`, `hasta`, `paso`, `romper`, `continuar`, `verdadero`, `falso`, `nulo`, `y`, `o`, `no`.

Como `y` y `o` son palabras reservadas, no se pueden usar como nombres de variables ni de campos.

`cada`, `en` y `registro` solo son especiales en su lugar (`para cada x en ...` y `registro Nombre { }`), así que también sirven como nombres.

## Mensajes de error

Kuntur informa la etapa, la línea y la columna, y señala el lugar exacto:

```
Error semántico en la línea 4, columna 27:
  4 | var mensaje = "Tienes " + edda + " años"
    |                           ^
`edda` no existe. ¿Quisiste decir `edad`?
```

| Etapa | Qué revisa |
|---|---|
| Error léxico | Caracteres desconocidos, textos sin cerrar, `&&` en vez de `y` |
| Error de sintaxis | Estructura: paréntesis, llaves, `=` en vez de `==` en condiciones |
| Error semántico | Antes de ejecutar: variables inexistentes, tipos incompatibles, argumentos, retornos |
| Error de compilación | Solo al compilar a WebAssembly: tipos que faltan para traducir el programa |
| Error de ejecución | Al ejecutar: división entre cero, posiciones fuera de rango, valores de tipo desconocido |

Para evitar que un programa se cuelgue, la ejecución se detiene después de 10 millones de pasos o de 400 llamadas anidadas.
