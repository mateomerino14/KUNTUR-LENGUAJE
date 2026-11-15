import {useState} from 'react';
import type {Section} from './layouts/PageHeader';
import {ExercisesPage} from './pages/ExercisesPage';
import {ExplorePage} from './pages/ExplorePage';
import {exerciseFromHash} from './utils/exerciseLink';

// La sección inicial depende del enlace: un enlace a un ejercicio abre Ejercicios
const initialSection = (): Section => {
  if (exerciseFromHash(window.location.hash) !== null) {
    return 'exercises';
  }
  return 'explore';
};

export const App = () => {
  const [section, setSection] = useState<Section>(initialSection);
  const changeSection = (next: Section) => {
    if (next === 'explore') {
      window.history.replaceState(null, '', window.location.pathname);
    }
    setSection(next);
  };
  if (section === 'exercises') {
    return <ExercisesPage onSectionChange={changeSection} />;
  }
  return <ExplorePage onSectionChange={changeSection} />;
};
