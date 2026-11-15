import {useImperativeHandle, useRef, type Ref} from 'react';
import type {Language} from '../../../../../src/index.js';
import {useCodeEditor, type EditorDiagnostic, type EditorPosition} from '../hooks/useCodeEditor';

export interface CodeEditorHandle {
  select: (position: EditorPosition) => void;
}

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  diagnostics: EditorDiagnostic[];
  stepLine: number | null;
  language?: Language;
  ref?: Ref<CodeEditorHandle>;
}

const styles = {
  container: 'h-full min-h-[320px] overflow-hidden',
};

export const CodeEditor = ({value, onChange, onRun, diagnostics, stepLine, language, ref}: CodeEditorProps) => {
  const container = useRef<HTMLDivElement>(null);
  const {select} = useCodeEditor(container, {value, onChange, onRun, diagnostics, stepLine, language});
  useImperativeHandle(ref, () => ({select}), [select]);
  return <div ref={container} className={styles.container} />;
};
