// Escribe la cantidad con la palabra en singular o plural
export const plural = (count: number, singular: string, pluralForm: string): string => {
  if (count === 1) {
    return `1 ${singular}`;
  }
  return `${count} ${pluralForm}`;
};
