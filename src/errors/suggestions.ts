const maxSuggestionDistance = 2;
const minLengthForDistanceTwo = 5;

// Calcula cuántas ediciones separan dos palabras; intercambiar dos letras vecinas cuenta como una
export const editDistance = (first: string, second: string): number => {
  const rows: number[][] = [];
  for (let i = 0; i <= first.length; i++) {
    rows.push([i]);
  }
  for (let j = 1; j <= second.length; j++) {
    rows[0][j] = j;
  }
  for (let i = 1; i <= first.length; i++) {
    for (let j = 1; j <= second.length; j++) {
      let substitutionCost = 1;
      if (first[i - 1] === second[j - 1]) {
        substitutionCost = 0;
      }
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + substitutionCost,
      );
      const isTransposition = i > 1 && j > 1 && first[i - 1] === second[j - 2] && first[i - 2] === second[j - 1];
      if (isTransposition) {
        rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
      }
    }
  }
  return rows[first.length][second.length];
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
