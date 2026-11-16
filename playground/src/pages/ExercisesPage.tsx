import {useMemo, useRef} from 'react';
import {EXERCISE_LEVELS, EXERCISES, type Position} from '../../../src/index.js';
import {Button} from '../components/ui/Button';
import {GroupedPicker} from '../components/ui/GroupedPicker';
import type {EditorDiagnostic} from '../features/editor/hooks/useCodeEditor';
import {CodeEditor, type CodeEditorHandle} from '../features/editor/organisms/CodeEditor';
import {ExercisePanel} from '../features/exercises/organisms/ExercisePanel';
import {PipelineBand} from '../features/pipeline/organisms/PipelineBand';
import {blockingDiagnostics, useAnalysis} from '../hooks/useAnalysis';
import {useExercises} from '../hooks/useExercises';
import {PageHeader, type Section} from '../layouts/PageHeader';
import {plural} from '../utils/plural';
import {gradeReport, stageReports} from '../utils/stageReports';

interface ExercisesPageProps {
  onSectionChange: (section: Section) => void;
}

const styles = {
  page: 'min-h-screen flex flex-col lg:h-screen',
  progress: 'text-[15px] text-ink-muted',
  shortcut: 'font-normal text-[13px] opacity-80',
  main: 'flex-1 min-h-0 grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]',
  editor: 'h-[55vh] min-h-[320px] lg:h-auto lg:min-h-0 border-b lg:border-b-0 lg:border-r border-line bg-paper',
  panel: 'flex flex-col min-h-[50vh] lg:min-h-0 overflow-auto',
};

export const ExercisesPage = ({onSectionChange}: ExercisesPageProps) => {
  const editor = useRef<CodeEditorHandle>(null);
  const exercises = useExercises();
  const analysis = useAnalysis(exercises.code);
  const blocking = useMemo(() => blockingDiagnostics(analysis), [analysis]);
  const reports = {
    ...stageReports(analysis, '', null, false, 'interpreter'),
    run: gradeReport(exercises.grade, exercises.gradeIsStale),
  };
  const editorDiagnostics = useMemo(() => {
    const diagnostics: EditorDiagnostic[] = blocking.map((diagnostic) => ({...diagnostic.position, message: diagnostic.message, severity: 'error'}));
    const failed = exercises.grade?.results.find((result) => result.outcome === 'runtime-error');
    for (const diagnostic of failed?.diagnostics ?? []) {
      diagnostics.push({...diagnostic.position, message: diagnostic.message, severity: 'error'});
    }
    return diagnostics;
  }, [blocking, exercises.grade]);
  const items = EXERCISES.map((exercise) => ({
    id: exercise.id,
    name: exercise.title,
    description: exercise.summary,
    group: exercise.level,
    done: exercises.solved.has(exercise.id),
  }));
  const selectPosition = (position: Position) => editor.current?.select(position);
  return (
    <div className={styles.page}>
      <PageHeader section="exercises" onSectionChange={onSectionChange}>
        <GroupedPicker
          idPrefix="ejercicio"
          label="Ejercicio"
          emptyLabel="Elige un ejercicio"
          groups={EXERCISE_LEVELS}
          items={items}
          value={exercises.exercise.id}
          onSelect={exercises.select}
        />
        <span className={styles.progress}>{plural(exercises.solved.size, 'resuelto', 'resueltos')} de {EXERCISES.length}</span>
        <Button variant="primary" onClick={exercises.check}>
          Comprobar <span className={styles.shortcut}>Ctrl + Enter</span>
        </Button>
      </PageHeader>
      <PipelineBand reports={reports} weaveKey={0} />
      <main className={styles.main}>
        <div className={styles.editor}>
          <CodeEditor
            ref={editor}
            value={exercises.code}
            onChange={exercises.setCode}
            onRun={exercises.check}
            diagnostics={editorDiagnostics}
            stepLine={null}
          />
        </div>
        <div className={styles.panel}>
          <ExercisePanel
            exercise={exercises.exercise}
            solved={exercises.solved.has(exercises.exercise.id)}
            grade={exercises.grade}
            gradeIsStale={exercises.gradeIsStale}
            nextExercise={exercises.nextExercise}
            onCheck={exercises.check}
            onRestart={exercises.restart}
            onNext={exercises.select}
            onSelectPosition={selectPosition}
          />
        </div>
      </main>
    </div>
  );
};
