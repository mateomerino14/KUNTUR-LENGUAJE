const exercisePrefix = '#ejercicio=';

// Lee el ejercicio del enlace actual, o null si el enlace no apunta a uno
export const exerciseFromHash = (hash: string): string | null => {
  if (!hash.startsWith(exercisePrefix)) {
    return null;
  }
  return decodeURIComponent(hash.slice(exercisePrefix.length));
};

// Enlace que abre directamente un ejercicio
export const exerciseHash = (id: string): string => `${exercisePrefix}${encodeURIComponent(id)}`;
