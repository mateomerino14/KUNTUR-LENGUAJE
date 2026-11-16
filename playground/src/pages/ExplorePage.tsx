import {LANGUAGES} from '../../../src/index.js';
import {Button} from '../components/ui/Button';
import {PageHeader, type Section} from '../layouts/PageHeader';
import {SegmentedControl} from '../components/ui/SegmentedControl';
import {Tabs} from '../components/ui/Tabs';
import {TABS} from '../constants/tabs';
import {CodeEditor} from '../features/editor/organisms/CodeEditor';
import {ExamplePicker} from '../features/examples/organisms/ExamplePicker';
import {OutputPanel} from '../features/output/organisms/OutputPanel';
import {PipelineBand} from '../features/pipeline/organisms/PipelineBand';
import {StepperPanel} from '../features/stepper/organisms/StepperPanel';
import {TokensPanel} from '../features/tokens/organisms/TokensPanel';
import {TreePanel} from '../features/tree/organisms/TreePanel';
import {WasmPanel} from '../features/wasm/organisms/WasmPanel';
import type {ExecutionMode} from '../hooks/useExecution';
import {usePlayground} from '../hooks/usePlayground';

const modeOptions: {value: ExecutionMode; label: string}[] = [
  {value: 'interpreter', label: 'Intérprete'},
  {value: 'wasm', label: 'WebAssembly'},
];

const languageOptions = LANGUAGES.map((language) => ({value: language.id, label: language.label}));

const styles = {
  page: 'min-h-screen flex flex-col lg:h-screen',
  shareMessage: 'text-[14px] text-teal font-bold',
  shortcut: 'font-normal text-[13px] opacity-80',
  main: 'flex-1 min-h-0 grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]',
  editor: 'h-[55vh] lg:h-auto min-h-0 border-b lg:border-b-0 lg:border-r border-line bg-paper',
  inspector: 'flex flex-col min-h-[50vh] lg:min-h-0',
};

interface ExplorePageProps {
  onSectionChange: (section: Section) => void;
}

export const ExplorePage = ({onSectionChange}: ExplorePageProps) => {
  const {editor, ...playground} = usePlayground();
  const blocked = playground.blocking.length > 0;
  return (
    <div className={styles.page}>
      <PageHeader section="explore" onSectionChange={onSectionChange}>
        <ExamplePicker value={playground.exampleId} onSelect={playground.selectExample} />
        <SegmentedControl label="Idioma de las palabras del lenguaje" options={languageOptions} value={playground.language} onChange={playground.changeLanguage} />
        <SegmentedControl label="Cómo ejecutar" options={modeOptions} value={playground.mode} onChange={playground.changeMode} />
        {playground.shareMessage && <span className={styles.shareMessage} role="status">{playground.shareMessage}</span>}
        <Button onClick={playground.share}>Compartir</Button>
        <Button variant="primary" onClick={playground.runProgram} disabled={playground.running} title="Ctrl + Enter">
          Ejecutar <span className={styles.shortcut}>Ctrl + Enter</span>
        </Button>
      </PageHeader>
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
            language={playground.language}
          />
        </div>
        <div className={styles.inspector}>
          <Tabs tabs={TABS} active={playground.activeTab} onChange={playground.setActiveTab}>
            {playground.activeTab === 'output' && (
              <OutputPanel
                blocking={playground.blocking}
                execution={playground.currentExecution}
                input={playground.input}
                showInput={playground.showInput}
                onInputChange={playground.setInput}
                onSelectPosition={playground.selectPosition}
              />
            )}
            {playground.activeTab === 'tokens' && (
              <TokensPanel tokens={playground.analysis.tokens} diagnostics={playground.analysis.lexerDiagnostics} onSelectPosition={playground.selectPosition} />
            )}
            {playground.activeTab === 'tree' && (
              <TreePanel
                program={playground.analysis.program}
                types={playground.analysis.types}
                language={playground.analysis.language}
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
