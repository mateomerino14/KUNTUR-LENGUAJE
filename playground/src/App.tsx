import {Button} from './components/ui/Button';
import {SegmentedControl} from './components/ui/SegmentedControl';
import {Tabs} from './components/ui/Tabs';
import {EXAMPLES} from './constants/examples';
import {TABS} from './constants/tabs';
import {CodeEditor} from './features/editor/organisms/CodeEditor';
import {OutputPanel} from './features/output/organisms/OutputPanel';
import {PipelineBand} from './features/pipeline/organisms/PipelineBand';
import {StepperPanel} from './features/stepper/organisms/StepperPanel';
import {TokensPanel} from './features/tokens/organisms/TokensPanel';
import {TreePanel} from './features/tree/organisms/TreePanel';
import {WasmPanel} from './features/wasm/organisms/WasmPanel';
import type {ExecutionMode} from './hooks/useExecution';
import {usePlayground} from './hooks/usePlayground';

const modeOptions: {value: ExecutionMode; label: string}[] = [
  {value: 'interpreter', label: 'Intérprete'},
  {value: 'wasm', label: 'WebAssembly'},
];

const styles = {
  page: 'min-h-screen flex flex-col lg:h-screen',
  header: 'flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4',
  brand: 'flex flex-col',
  title: 'text-[28px] leading-none font-bold tracking-tight',
  tagline: 'text-[15px] text-ink-muted mt-1',
  actions: 'flex flex-wrap items-center gap-3',
  selectLabel: 'flex items-center gap-2 text-[15px] text-ink-muted',
  select: 'bg-paper border border-line rounded-md px-3 py-2 text-ink text-[15px] cursor-pointer',
  shareMessage: 'text-[14px] text-teal font-bold',
  shortcut: 'font-normal text-[13px] opacity-80',
  main: 'flex-1 min-h-0 grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]',
  editor: 'h-[55vh] lg:h-auto min-h-0 border-b lg:border-b-0 lg:border-r border-line bg-paper',
  inspector: 'flex flex-col min-h-[50vh] lg:min-h-0',
};

export const App = () => {
  const {editor, ...playground} = usePlayground();
  const blocked = playground.blocking.length > 0;
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <h1 className={styles.title}>Kuntur</h1>
          <p className={styles.tagline}>Un lenguaje de programación en español, y lo que pasa por dentro</p>
        </div>
        <div className={styles.actions}>
          <label className={styles.selectLabel}>
            Ejemplo
            <select className={styles.select} value={playground.exampleId} onChange={(event) => playground.selectExample(event.target.value)}>
              {playground.exampleId === playground.customExampleId && <option value={playground.customExampleId}>Tu programa</option>}
              {EXAMPLES.map((example) => <option key={example.id} value={example.id}>{example.name}</option>)}
            </select>
          </label>
          <SegmentedControl label="Cómo ejecutar" options={modeOptions} value={playground.mode} onChange={playground.changeMode} />
          {playground.shareMessage && <span className={styles.shareMessage} role="status">{playground.shareMessage}</span>}
          <Button onClick={playground.share}>Compartir</Button>
          <Button variant="primary" onClick={playground.runProgram} disabled={playground.running} title="Ctrl + Enter">
            Ejecutar <span className={styles.shortcut}>Ctrl + Enter</span>
          </Button>
        </div>
      </header>
      <PipelineBand reports={playground.reports} weaveKey={playground.weaveKey} onSelectTab={playground.setActiveTab} />
      <main className={styles.main}>
        <div className={styles.editor}>
          <CodeEditor
            ref={editor}
            value={playground.source}
            onChange={playground.setSource}
            onRun={playground.runProgram}
            diagnostics={playground.editorDiagnostics}
            stepLine={playground.stepLine}
          />
        </div>
        <div className={styles.inspector}>
          <Tabs tabs={TABS} active={playground.activeTab} onChange={playground.setActiveTab}>
            {playground.activeTab === 'output' && (
              <OutputPanel blocking={playground.blocking} execution={playground.currentExecution} onSelectPosition={playground.selectPosition} />
            )}
            {playground.activeTab === 'tokens' && (
              <TokensPanel tokens={playground.analysis.tokens} diagnostics={playground.analysis.lexerDiagnostics} onSelectPosition={playground.selectPosition} />
            )}
            {playground.activeTab === 'tree' && (
              <TreePanel
                program={playground.analysis.program}
                types={playground.analysis.types}
                diagnostics={playground.analysis.parserDiagnostics}
                onSelectPosition={playground.selectPosition}
              />
            )}
            {playground.activeTab === 'wasm' && (
              <WasmPanel analysis={playground.analysis} blocked={blocked} onSelectPosition={playground.selectPosition} />
            )}
            {playground.activeTab === 'stepper' && (
              <StepperPanel
                execution={playground.currentExecution?.mode === 'interpreter' ? playground.currentExecution : null}
                stepIndex={playground.stepIndex}
                onStepChange={playground.changeStep}
                onRunStepper={playground.runStepper}
                blocked={blocked}
              />
            )}
          </Tabs>
        </div>
      </main>
    </div>
  );
};
