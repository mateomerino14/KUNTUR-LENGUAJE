export type ReadOnlyKind = 'constant' | 'loop' | 'function' | 'native';

const readOnlyMessages: Readonly<Record<ReadOnlyKind, (name: string) => string>> = {
  constant: (name) => `\`${name}\` es una constante; su valor no se puede cambiar.`,
  loop: (name) => `\`${name}\` es la variable del ciclo \`para\`; no se puede cambiar dentro del ciclo.`,
  function: (name) => `\`${name}\` es una función; no se le puede asignar un valor.`,
  native: (name) => `\`${name}\` es una función propia de Kuntur. Para usar ese nombre en una variable, decláralo con \`var ${name} = ...\`.`,
};

// Explica por qué no se puede asignar a un nombre que no es una variable común
export const readOnlyMessage = (kind: ReadOnlyKind, name: string): string => readOnlyMessages[kind](name);

// Arma "1 valor" o "N valores" según la cantidad
export const countValues = (count: number): string => {
  if (count === 1) {
    return '1 valor';
  }
  return `${count} valores`;
};

// Explica que una función recibió otra cantidad de argumentos
export const arityMessage = (name: string, expected: number, received: number): string => {
  return `La función \`${name}\` espera ${countValues(expected)}, pero recibió ${countValues(received)}.`;
};

// Explica cómo crear una variable que se intentó asignar sin declarar
export const undeclaredAssignmentMessage = (name: string): string => {
  return `\`${name}\` no existe. Para crearla escribe \`var ${name} = ...\`.`;
};

// Explica que un nombre se declaró dos veces en el mismo bloque
export const redeclarationMessage = (name: string): string => {
  return `Ya existe algo llamado \`${name}\` en este bloque; elige otro nombre.`;
};

export const divisionByZeroMessage = 'No se puede dividir entre cero.';

export const zeroStepMessage = 'El `paso` no puede ser cero: el ciclo nunca terminaría.';

// Explica que el programa superó el límite de pasos
export const tooManyStepsMessage = (maxSteps: number): string => {
  return `El programa superó el límite de ${maxSteps} pasos. ¿Hay un ciclo que nunca termina?`;
};

// Explica que hay demasiadas llamadas anidadas, nombrando la función si se conoce
export const tooDeepMessage = (name?: string): string => {
  let subject = 'una función';
  if (name !== undefined) {
    subject = `\`${name}\``;
  }
  return `Hay demasiadas llamadas anidadas a ${subject}. ¿Se llama a sí misma sin una condición que la detenga?`;
};
