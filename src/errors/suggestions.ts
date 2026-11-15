const maxSuggestionDistance = 2;
const minLengthForDistanceTwo = 5;

// Calcula cuántas ediciones de un carácter separan dos palabras (distancia de Levenshtein)
export const editDistance = (first: string, second: string): number => {
  let previousRow = Array.from({length: second.length + 1}, (_, index) => index);
  for (let i = 1; i <= first.length; i++) {
    const currentRow = [i];
    for (let j = 1; j <= second.length; j++) {
      let substitutionCost = 1;
      if (first[i - 1] === second[j - 1]) {
        substitutionCost = 0;
      }
      currentRow[j] = Math.min(
        previousRow[j] + 1,
        currentRow[j - 1] + 1,
        previousRow[j - 1] + substitutionCost,
      );
    }
    previousRow = currentRow;
  }
  return previousRow[second.length];
};

// Distancia máxima aceptada según el largo del nombre, para no sugerir palabras sin relación
const allowedDistance = (name: string): number => {
  if (name.length < minLengthForDistanceTwo) {
    return 1;
  }
  return maxSuggestionDistance;
};

// Busca entre los candidatos el nombre más parecido al escrito, o null si ninguno se parece
export const suggestName = (name: string, candidates: Iterable<string>): string | null => {
  let bestCandidate: string | null = null;
  let bestDistance = allowedDistance(name) + 1;
  const lowerName = name.toLowerCase();
  for (const candidate of candidates) {
    if (candidate === name) {
      continue;
    }
    const distance = editDistance(lowerName, candidate.toLowerCase());
    if (distance < bestDistance) {
      bestDistance = distance;
      bestCandidate = candidate;
    }
  }
  return bestCandidate;
};

// Agrega a un mensaje la sugerencia "¿Quisiste decir...?" cuando hay un nombre parecido
export const withSuggestion = (message: string, name: string, candidates: Iterable<string>): string => {
  const suggestion = suggestName(name, candidates);
  if (suggestion === null) {
    return message;
  }
  return `${message} ¿Quisiste decir \`${suggestion}\`?`;
};
