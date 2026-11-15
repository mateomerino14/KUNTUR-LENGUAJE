# Ejercicios con corrección automática

La sección **Ejercicios** del playground propone problemas para resolver en Kuntur. Cada uno trae un enunciado, un código inicial y casos de prueba: al presionar **Comprobar**, el programa se ejecuta con cada caso y se compara lo que muestra con lo esperado.

## Cómo se corrige

- Antes de correr los casos se revisa el programa: si tiene errores de sintaxis o de tipos, se muestran y no se ejecuta nada.
- Cada caso entrega sus líneas de entrada a `leer`, una por llamada.
- Solo cuenta lo que muestra `mostrar`; las preguntas de `leer` no forman parte de la salida.
- La salida debe coincidir línea por línea. Los espacios al final de una línea no cuentan.
- Cada caso tiene un límite de un millón de pasos, para cortar los ciclos infinitos.

Hay dos clases de casos:

| Caso | Qué se ve |
|---|---|
| Visible | Se muestra como ejemplo. Si falla, se ve la entrada, lo esperado y lo que mostró el programa, con la primera línea distinta marcada. |
| Oculto | Solo dice si pasó. Evita que un programa responda de memoria a los ejemplos. |

El progreso y el código de cada ejercicio se guardan en el navegador. Cada ejercicio tiene su enlace (`#ejercicio=fibonacci`) para compartirlo.

## Ejercicios

| Nivel | Ejercicio | Practica |
|---|---|---|
| Fácil | Saluda por nombre | `leer` y unir textos |
| Fácil | ¿Par o impar? | El residuo `%` y `si` |
| Fácil | Suma de 1 a N | El ciclo `para` |
| Fácil | El mayor de tres | Comparaciones encadenadas |
| Intermedio | Tabla de multiplicar | Un formato de salida exacto |
| Intermedio | Pasajes en micro | Decimales |
| Intermedio | Contar vocales | Recorrer un texto y escribir una función |
| Intermedio | Notas del curso | Promedio y conteo en un mismo ciclo |
| Desafío | ¿Es primo? | Buscar divisores |
| Desafío | Al revés | Armar un texto con `paso -1` |
| Desafío | Fibonacci | Llevar dos valores a la vez |

## Agregar un ejercicio

1. Agrega una entrada a `EXERCISES` en `src/exercises/catalog.ts`, con al menos un caso visible (`shown`) y uno oculto (`hidden`).
2. Escribe su solución de referencia en `solutions`, en `tests/exercises/exercises.test.ts`.
3. Corre `npm test`. Las pruebas verifican que la solución pase todos los casos y que el código inicial no venga resuelto.
