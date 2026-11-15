import {useCallback, useEffect, useMemo, useState} from 'react';
import {EXERCISES, gradeExercise, type Exercise, type GradeResult} from '../../../src/index.js';
import {exerciseFromHash, exerciseHash} from '../utils/exerciseLink';
import {loadProgress, saveProgress, type ExerciseProgress} from '../utils/progressStorage';

interface Grade {
  source: string;
  result: GradeResult;
}

// Ejercicio inicial: el del enlace, el último abierto o el primero
const initialExerciseId = (progress: ExerciseProgress): string => {
  const candidates = [exerciseFromHash(window.location.hash), progress.current];
  const found = candidates.find((id) => id !== null && EXERCISES.some((exercise) => exercise.id === id));
  return found ?? EXERCISES[0].id;
};

export const useExercises = () => {
  const [progress, setProgress] = useState<ExerciseProgress>(loadProgress);
  const [exerciseId, setExerciseId] = useState(() => initialExerciseId(progress));
  const [grade, setGrade] = useState<Grade | null>(null);

  const exercise: Exercise = EXERCISES.find((candidate) => candidate.id === exerciseId) ?? EXERCISES[0];
  const code = progress.code[exercise.id] ?? exercise.starter;
  const solved = useMemo(() => new Set(progress.solved), [progress.solved]);

  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  const setCode = useCallback((value: string) => {
    setProgress((current) => ({...current, code: {...current.code, [exerciseId]: value}}));
  }, [exerciseId]);

  useEffect(() => {
    window.history.replaceState(null, '', `${window.location.pathname}${exerciseHash(exercise.id)}`);
  }, [exercise.id]);

  const select = useCallback((id: string) => {
    setExerciseId(id);
    setGrade(null);
    setProgress((current) => ({...current, current: id}));
  }, []);

  const check = useCallback(() => {
    const result = gradeExercise(code, exercise);
    setGrade({source: code, result});
    if (result.solved) {
      setProgress((current) => {
        if (current.solved.includes(exercise.id)) {
          return current;
        }
        return {...current, solved: [...current.solved, exercise.id]};
      });
    }
  }, [code, exercise]);

  const restart = useCallback(() => {
    setGrade(null);
    setProgress((current) => {
      const nextCode = {...current.code};
      delete nextCode[exerciseId];
      return {...current, code: nextCode};
    });
  }, [exerciseId]);

  const index = EXERCISES.findIndex((candidate) => candidate.id === exercise.id);
  const nextExercise = EXERCISES[index + 1] ?? null;
  let currentGrade: GradeResult | null = null;
  if (grade !== null && grade.source === code) {
    currentGrade = grade.result;
  }

  return {
    exercise,
    code,
    setCode,
    solved,
    select,
    check,
    restart,
    grade: currentGrade,
    gradeIsStale: grade !== null && grade.source !== code,
    nextExercise,
  };
};
