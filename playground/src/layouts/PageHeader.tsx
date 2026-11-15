import type {ReactNode} from 'react';

export type Section = 'explore' | 'exercises';

interface PageHeaderProps {
  section: Section;
  onSectionChange: (section: Section) => void;
  children: ReactNode;
}

const sections: {id: Section; label: string}[] = [
  {id: 'explore', label: 'Explorar'},
  {id: 'exercises', label: 'Ejercicios'},
];

const styles = {
  header: 'flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4',
  start: 'flex flex-wrap items-end gap-x-8 gap-y-2',
  brand: 'flex flex-col',
  title: 'text-[28px] leading-none font-bold tracking-tight',
  tagline: 'text-[15px] text-ink-muted mt-1',
  nav: 'flex gap-1',
  link: 'px-3 py-[6px] text-[16px] rounded-md cursor-pointer border-b-[3px]',
  linkActive: 'font-bold text-ink border-ink rounded-b-none',
  linkIdle: 'text-ink-muted border-transparent hover:text-ink',
  actions: 'flex flex-wrap items-center gap-3',
};

export const PageHeader = ({section, onSectionChange, children}: PageHeaderProps) => (
  <header className={styles.header}>
    <div className={styles.start}>
      <div className={styles.brand}>
        <h1 className={styles.title}>Kuntur</h1>
        <p className={styles.tagline}>Un lenguaje de programación en español, y lo que pasa por dentro</p>
      </div>
      <nav className={styles.nav} aria-label="Secciones">
        {sections.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`${styles.link} ${item.id === section ? styles.linkActive : styles.linkIdle}`}
            aria-current={item.id === section ? 'page' : undefined}
            onClick={() => onSectionChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </div>
    <div className={styles.actions}>{children}</div>
  </header>
);
