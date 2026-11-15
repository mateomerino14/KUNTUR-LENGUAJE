import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {Position} from '../../../src/index.js';
import {DEFAULT_EXAMPLE, EXAMPLES} from '../constants/examples';
import type {TabId} from '../constants/tabs';
import type {CodeEditorHandle} from '../features/editor/organisms/CodeEditor';
import type {EditorDiagnostic} from '../features/editor/hooks/useCodeEditor';
import {sourceFromHash} from '../utils/shareCode';
import {stageReports} from '../utils/stageReports';
import {blockingDiagnostics, useAnalysis} from './useAnalysis';
import {useExecution, type ExecutionMode} from './useExecution';
import {useShareLink} from './useShareLink';

const customExampleId = 'propio';

// Código inicial: el del enlace compartido o el ejemplo por defecto
const initialSource = (): string => sourceFromHash(window.location.hash) ?? DEFAULT_EXAMPLE.source;

// Indica qué ejemplo coincide con el código, o el código propio si ninguno
const exampleIdFor = (source: string): string => {
  const example = EXAMPLES.find((candidate) => candidate.source === source);
  if (example === undefined) {
    return customExampleId;
  }
  return example.id;
};

export const usePlayground = () => {
  const [source, setSource] = useState(initialSource);
  const [activeTab, setActiveTab] = useState<TabId>('output');
  const [stepIndex, setStepIndex] = useState(0);
  const [weaveKey, setWeaveKey] = useState(0);
  const editor = useRef<CodeEditorHandle>(null);
  const analysis = useAnalysis(source);
  const {mode, setMode, execution, running, execute} = useExecution();
  const {share, message: shareMessage} = useShareLink();

  useEffect(() => {
    const loadFromHash = () => {
      const shared = sourceFromHash(window.location.hash);
      if (shared !== null) {
        setSource(shared);
      }
    };
    window.addEventListener('hashchange', loadFromHash);
    return () => window.removeEventListener('hashchange', loadFromHash);
  }, []);

  const blocking = useMemo(() => blockingDiagnostics(analysis), [analysis]);
  let currentExecution = null;
  if (execution !== null && execution.source === source && execution.mode === mode) {
    currentExecution = execution;
  }
  const reports = stageReports(analysis, execution, running, mode);

  const editorDiagnostics = useMemo(() => {
    const diagnostics: EditorDiagnostic[] = blocking.map((diagnostic) => ({...diagnostic.position, message: diagnostic.message, severity: 'error'}));
    if (mode === 'wasm') {
      for (const diagnostic of analysis.compilerDiagnostics) {
        diagnostics.push({...diagnostic.position, message: diagnostic.message, severity: 'warning'});
      }
    }
    for (const diagnostic of currentExecution?.diagnostics ?? []) {
      diagnostics.push({...diagnostic.position, message: diagnostic.message, severity: 'error'});
    }
    return diagnostics;
  }, [blocking, mode, analysis.compilerDiagnostics, currentExecution]);

  let stepLine: number | null = null;
  if (activeTab === 'stepper' && currentExecution !== null && currentExecution.trace.length > 0) {
    stepLine = currentExecution.trace[Math.min(stepIndex, currentExecution.trace.length - 1)].position.line;
  }

  const runProgram = useCallback(async () => {
    await execute(source, mode);
    setWeaveKey((key) => key + 1);
    setStepIndex(0);
    setActiveTab((tab) => {
      if (tab === 'stepper' && mode === 'interpreter') {
        return tab;
      }
      return 'output';
    });
  }, [execute, source, mode]);

  const runStepper = useCallback(async () => {
    setMode('interpreter');
    await execute(source, 'interpreter');
    setWeaveKey((key) => key + 1);
    setStepIndex(0);
    setActiveTab('stepper');
  }, [execute, setMode, source]);

  const selectExample = useCallback((id: string) => {
    const example = EXAMPLES.find((candidate) => candidate.id === id);
    if (example !== undefined) {
      setSource(example.source);
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const selectPosition = useCallback((position: Position) => {
    editor.current?.select(position);
  }, []);

  const changeStep = useCallback((index: number) => {
    const total = currentExecution?.trace.length ?? 0;
    setStepIndex(Math.min(Math.max(index, 0), Math.max(total - 1, 0)));
  }, [currentExecution]);

  const changeMode = useCallback((nextMode: ExecutionMode) => setMode(nextMode), [setMode]);

  return {
    editor,
    source,
    setSource,
    analysis,
    blocking,
    mode,
    changeMode,
    running,
    currentExecution,
    reports,
    weaveKey,
    activeTab,
    setActiveTab,
    stepIndex,
    changeStep,
    stepLine,
    editorDiagnostics,
    exampleId: exampleIdFor(source),
    customExampleId,
    selectExample,
    selectPosition,
    runProgram,
    runStepper,
    share: () => share(source),
    shareMessage,
  };
};
