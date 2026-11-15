import {readdirSync, readFileSync} from 'node:fs';
import {describe, expect, test} from 'vitest';
import {runWasiModule} from '../../src/compiler/wasi/nodeRunner.js';
import {compile, run, runCompiled, translateSource} from '../../src/index.js';

const examplesDirectory = 'ejemplos';
const examples = readdirSync(examplesDirectory).filter((name) => name.endsWith('.kun') && !['promedio.kun', 'error.kun'].includes(name));

// Mensajes de error de un programa escrito en quechua
const messagesOf = (source: string): string[] => run(source, {language: 'qu'}).diagnostics.map((diagnostic) => diagnostic.message);

describe('modo quechua', () => {
  // Cada ejemplo traducido da la misma salida en los tres motores, y la traducción vuelve al original
  test.each(examples)('traduce y ejecuta %s', async (name) => {
    const spanish = readFileSync(`${examplesDirectory}/${name}`, 'utf8');
    const quechua = translateSource(spanish, 'qu');
    expect(translateSource(quechua, 'es')).toBe(spanish);
    const expected = run(spanish);
    expect(run(quechua, {language: 'qu'})).toEqual(expected);
    expect(await runCompiled(quechua, {language: 'qu'})).toEqual(expected);
    const {binary} = compile(quechua, {language: 'qu', target: 'wasi'});
    const standalone = await runWasiModule(binary!, '');
    expect(standalone.stdout).toBe(expected.output.map((line) => `${line}\n`).join(''));
  });

  // Las palabras del lenguaje se escriben en quechua
  test('ejecuta un programa escrito en quechua', () => {
    const source = [
      'mana tikraq tope = 4',
      'ruray esPar(n: entero): logico {',
      '  kutichiy n % 2 == 0',
      '}',
      'sapanka i qallarispa 1 kama tope {',
      '  sichus esPar(i) chantapas mana (i == 4) {',
      '    rikuchiy(i, "par")',
      '  }',
      '  manachus sichus i == 3 utaq llulla {',
      '    qatiy',
      '  }',
      '  manachus {',
      '    rikuchiy(i, cheqaq)',
      '  }',
      '}',
      'kay k = 0',
      'kaykama cheqaq {',
      '  k = k + 1',
      '  sichus k > 2 {',
      "    p'akiy",
      '  }',
      '}',
      "kay p'unchay = ch'usaq",
      "rikuchiy(k, p'unchay)",
    ].join('\n');
    expect(run(source, {language: 'qu'})).toEqual({output: ['1 verdadero', '2 par', '4 verdadero', '3 nulo'], diagnostics: []});
  });

  // Los errores muestran las palabras del lenguaje en quechua
  test('muestra los errores con las palabras en quechua', () => {
    expect(messagesOf("p'akiy")[0]).toBe("`p'akiy` solo se puede usar dentro de un ciclo `kaykama` o `sapanka`.");
    expect(messagesOf('mana tikraq k = 1\nk = 2')[0]).toBe('`k` es una constante; su valor no se puede cambiar.');
  });

  // En español, las palabras en quechua son nombres comunes
  test('no reserva las palabras en quechua al escribir en español', () => {
    expect(run('var kay = 2\nvar kama = 3\nmostrar(kay + kama)').output).toEqual(['5']);
  });

  // Al traducir, los nombres que chocan con palabras del otro idioma se renombran
  test('renombra los nombres que chocan al traducir', () => {
    expect(translateSource('var kay = 2\nmostrar(kay)', 'qu')).toBe('kay kay_ = 2\nrikuchiy(kay_)');
    expect(translateSource("kay p'unchay = 2", 'es')).toBe('var p_unchay = 2');
  });
});
