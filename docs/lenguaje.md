# Referencia del lenguaje Kuntur

Kuntur es un lenguaje pequeño, con palabras clave en español. Esta referencia describe lo que funciona en la versión actual (fase 1: intérprete).

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
| número | `42`, `3.14`, `-7` |
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
- Las anotaciones de tipo (`var edad: entero = 20`) se aceptan, pero todavía no se verifican; se verificarán en la fase 2.

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

## Funciones propias

| Función | Descripción |
|---|---|
| `mostrar(a, b, ...)` | Muestra los valores en una línea, separados por un espacio |
| `longitud(x)` | Cantidad de elementos de una lista o de caracteres de un texto |
| `agregar(lista, valor)` | Agrega un valor al final de la lista |
| `quitar(lista)` | Quita y devuelve el último elemento |
| `texto(x)` | Convierte un valor en texto |
| `numero(x)` | Convierte un texto como `"42"` en número |
| `tipo(x)` | Devuelve el nombre del tipo: `"número"`, `"texto"`, `"lista"`... |
| `redondear(x)` | Redondea al entero más cercano |
| `raiz(x)` | Raíz cuadrada |
| `aleatorio(min, max)` | Entero al azar entre `min` y `max`, ambos incluidos |

Sus nombres se pueden usar para variables propias (`var texto = "hola"`); en ese caso la variable tapa a la función dentro de su bloque.

## Palabras reservadas

`var`, `constante`, `funcion` (o `función`), `retornar`, `si`, `sino`, `mientras`, `para`, `desde`, `hasta`, `paso`, `romper`, `continuar`, `verdadero`, `falso`, `nulo`, `y`, `o`, `no`.

Como `y` y `o` son palabras reservadas, no se pueden usar como nombres de variables.

## Mensajes de error

Kuntur informa la etapa, la línea y la columna, y señala el lugar exacto:

```
Error de ejecución en la línea 4, columna 27:
  4 | var mensaje = "Tienes " + edda + " años"
    |                           ^
`edda` no existe. ¿Quisiste decir `edad`?
```

| Etapa | Qué revisa |
|---|---|
| Error léxico | Caracteres desconocidos, textos sin cerrar, `&&` en vez de `y` |
| Error de sintaxis | Estructura: paréntesis, llaves, `=` en vez de `==` en condiciones |
| Error de ejecución | Variables inexistentes, tipos incompatibles, posiciones fuera de rango |

Para evitar que un programa se cuelgue, la ejecución se detiene después de 10 millones de pasos o de 400 llamadas anidadas.
