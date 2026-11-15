const storageKey = 'kuntur.ejercicios';

export interface ExerciseProgress {
  solved: string[];
  code: Record<string, string>;
  current: string | null;
}

const emptyProgress: ExerciseProgress = {solved: [], code: {}, current: null};

// Lee el progreso guardado en este navegador; si no hay o no se puede leer, empieza de cero
export const loadProgress = (): ExerciseProgress => {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored === null) {
      return emptyProgress;
    }
    return {...emptyProgress, ...JSON.parse(stored) as Partial<ExerciseProgress>};
  }
  catch {
    return emptyProgress;
  }
};

// Guarda el progreso; si el navegador no lo permite, el progreso solo dura mientras la página esté abierta
export const saveProgress = (progress: ExerciseProgress): void => {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(progress));
  }
  catch {
    // Sin almacenamiento disponible, por ejemplo en modo privado: se sigue sin guardar
  }
};
