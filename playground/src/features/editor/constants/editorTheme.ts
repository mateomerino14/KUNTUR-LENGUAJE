import {HighlightStyle, syntaxHighlighting} from '@codemirror/language';
import {EditorView} from '@codemirror/view';
import {tags} from '@lezer/highlight';
import {COLORS} from '../../../constants/colors';

export const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '15px',
    backgroundColor: COLORS.paper,
    color: COLORS.ink,
  },
  '.cm-scroller': {
    fontFamily: 'var(--font-mono)',
    lineHeight: '1.6',
  },
  '.cm-content': {
    padding: '12px 0',
    caretColor: COLORS.ink,
  },
  '.cm-gutters': {
    backgroundColor: COLORS.paper,
    color: COLORS.inkMuted,
    border: 'none',
    paddingLeft: '8px',
  },
  '.cm-activeLine, .cm-activeLineGutter': {
    backgroundColor: 'transparent',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: COLORS.selection,
  },
  '.cm-lintRange-error': {
    backgroundImage: 'none',
    textDecoration: `underline wavy ${COLORS.error}`,
    textUnderlineOffset: '4px',
  },
  '.cm-lintRange-warning': {
    backgroundImage: 'none',
    textDecoration: `underline wavy ${COLORS.mustard}`,
    textUnderlineOffset: '4px',
  },
  '.cm-tooltip': {
    fontFamily: 'var(--font-sans)',
    border: `1px solid ${COLORS.line}`,
    backgroundColor: COLORS.paper,
  },
  '.cm-diagnostic': {
    maxWidth: '420px',
    padding: '6px 10px',
  },
});

export const editorHighlight = syntaxHighlighting(HighlightStyle.define([
  {tag: tags.keyword, color: COLORS.fuchsia, fontWeight: '700'},
  {tag: tags.atom, color: COLORS.violet},
  {tag: tags.number, color: COLORS.blue},
  {tag: tags.string, color: COLORS.teal},
  {tag: tags.comment, color: COLORS.inkMuted, fontStyle: 'italic'},
  {tag: tags.typeName, color: COLORS.violet, fontWeight: '700'},
  {tag: tags.standard(tags.variableName), color: COLORS.blue, fontWeight: '700'},
  {tag: tags.operator, color: COLORS.inkMuted},
]));
