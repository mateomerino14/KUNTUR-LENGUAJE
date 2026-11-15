# Modo quechua (runasimi)

Kuntur se puede escribir con las palabras del lenguaje en quechua. El programa es el mismo: cambian solo las palabras clave, y por dentro pasa por las mismas etapas, con los mismos tipos y la misma compilación a WebAssembly.

```
ruray factorial(n: entero): entero {
    sichus n <= 1 {
        kutichiy 1
    }
    kutichiy n * factorial(n - 1)
}

sapanka i qallarispa 1 kama 5 {
    rikuchiy(i, factorial(i))
}
```

## Vocabulario

| Español | Runasimi |
|---|---|
| `var` | `kay` |
| `constante` | `mana tikraq` |
| `funcion` | `ruray` |
| `retornar` | `kutichiy` |
| `si` / `sino` | `sichus` / `manachus` |
| `mientras` | `kaykama` |
| `para`, `desde`, `hasta` | `sapanka`, `qallarispa`, `kama` |
| `romper` / `continuar` | `p'akiy` / `qatiy` |
| `verdadero` / `falso` / `nulo` | `cheqaq` / `llulla` / `ch'usaq` |
| `y` / `o` / `no` | `chantapas` / `utaq` / `mana` |
| `mostrar` / `leer` | `rikuchiy` / `tapuy` |

Las demás palabras siguen en español por ahora: `paso`, `cada`, `en`, `registro`, los tipos (`entero`, `lista de`...) y las otras funciones propias.

## Cómo usarlo

- **Playground:** elige **Runasimi** en el selector de idioma. El código que está en el editor se traduce solo, los ejemplos se cargan traducidos y el enlace de Compartir guarda el idioma.
- **Terminal:** agrega `--runasimi` a cualquier opción, por ejemplo `npm run kuntur -- --runasimi programa.kun`.
- **Librería:** las funciones aceptan `{language: 'qu'}`, y `translateSource(codigo, 'qu')` traduce un programa de un idioma al otro.

## Detalles

- En quechua, el apóstrofo forma parte de la palabra cuando está entre letras, como en `p'akiy`. También se puede usar en nombres propios: `kay p'unchay = 1`.
- Las palabras en español siguen funcionando dentro de un programa en quechua.
- Al escribir en español, las palabras en quechua no están reservadas: `var kay = 2` es válido. Si se traduce ese programa a quechua, la variable pasa a llamarse `kay_` para no chocar con la palabra clave.
- Los mensajes de error muestran las palabras del lenguaje en quechua (`` `p'akiy` solo se puede usar dentro de un ciclo `kaykama` o `sapanka` ``), pero el resto del texto sigue en español.
- `mostrar` escribe los valores lógicos como `verdadero` y `falso`, en los dos idiomas.
