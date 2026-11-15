import {defaultKeymap, history, historyKeymap, indentWithTab} from '@codemirror/commands';
import {indentOnInput, bracketMatching} from '@codemirror/language';
import {setDiagnostics, type Diagnostic as LintDiagnostic} from '@codemirror/lint';
import {EditorState, StateEffect, StateField, type Extension} from '@codemirror/state';
import {Decoration, EditorView, keymap, lineNumbers, type DecorationSet} from '@codemirror/view';
import {useEffect, useRef, type RefObject} from 'react';
import {tokenRangeAt} from '../../../utils/editorRanges';
import {editorHighlight, editorTheme} from '../constants/editorTheme';
import {kunturLanguage} from '../constants/kunturLanguage';

export interface EditorDiagnostic {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning';
}

export interface EditorPosition {
  line: number;
  column: number;
}

interface UseCodeEditorOptions {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  diagnostics: EditorDiagnostic[];
  stepLine: number | null;
  readOnly?: boolean;
  extensions?: Extension[];
}

const setStepLine = StateEffect.define<number | null>();
const stepLineDecoration = Decoration.line({class: 'cm-step-line'});

const stepLineField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update: (decorations, transaction) => {
    let next = decorations.map(transaction.changes);
    for (const effect of transaction.effects) {
      if (!effect.is(setStepLine)) {
        continue;
      }
      if (effect.value === null || effect.value > transaction.state.doc.lines) {
        next = Decoration.none;
      }
      else {
        next = Decoration.set([stepLineDecoration.range(transaction.state.doc.line(effect.value).from)]);
      }
    }
    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

export const useCodeEditor = (container: RefObject<HTMLDivElement | null>, options: UseCodeEditorOptions) => {
  const viewRef = useRef<EditorView | null>(null);
  const callbacks = useRef({onChange: options.onChange, onRun: options.onRun});

  useEffect(() => {
    callbacks.current = {onChange: options.onChange, onRun: options.onRun};
  }, [options.onChange, options.onRun]);

  useEffect(() => {
    if (container.current === null) {
      return undefined;
    }
    const runKeymap = keymap.of([{key: 'Mod-Enter', run: () => {
      callbacks.current.onRun();
      return true;
    }}]);
    const view = new EditorView({
      parent: container.current,
      state: EditorState.create({
        doc: options.value,
        extensions: [
          lineNumbers(),
          history(),
          indentOnInput(),
          bracketMatching(),
          runKeymap,
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          kunturLanguage,
          editorHighlight,
          editorTheme,
          stepLineField,
          EditorState.readOnly.of(options.readOnly ?? false),
          EditorView.contentAttributes.of({'aria-label': 'Código de Kuntur'}),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              callbacks.current.onChange(update.state.doc.toString());
            }
          }),
          ...(options.extensions ?? []),
        ],
      }),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // El editor se crea una sola vez; los cambios de valor se aplican en el efecto siguiente
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [container]);

  useEffect(() => {
    const view = viewRef.current;
    if (view === null || view.state.doc.toString() === options.value) {
      return;
    }
    view.dispatch({changes: {from: 0, to: view.state.doc.length, insert: options.value}});
  }, [options.value]);

  useEffect(() => {
    const view = viewRef.current;
    if (view === null) {
      return;
    }
    const lintDiagnostics: LintDiagnostic[] = options.diagnostics.map((diagnostic) => {
      const range = tokenRangeAt(view.state.doc, diagnostic.line, diagnostic.column);
      return {from: range.from, to: range.to, severity: diagnostic.severity, message: diagnostic.message};
    });
    view.dispatch(setDiagnostics(view.state, lintDiagnostics));
  }, [options.diagnostics]);

  useEffect(() => {
    const view = viewRef.current;
    if (view === null) {
      return;
    }
    const effects: StateEffect<unknown>[] = [setStepLine.of(options.stepLine)];
    if (options.stepLine !== null && options.stepLine <= view.state.doc.lines) {
      effects.push(EditorView.scrollIntoView(view.state.doc.line(options.stepLine).from, {y: 'center'}));
    }
    view.dispatch({effects});
  }, [options.stepLine]);

  const select = (position: EditorPosition) => {
    const view = viewRef.current;
    if (view === null) {
      return;
    }
    const range = tokenRangeAt(view.state.doc, position.line, position.column);
    view.dispatch({selection: {anchor: range.from, head: range.to}, scrollIntoView: true});
    view.focus();
  };

  return {select};
};
