import type {ReactNode} from 'react';

interface ButtonProps {
  children: ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  title?: string;
}

const styles = {
  base: 'inline-flex items-center gap-2 px-4 py-2 rounded-md text-[15px] font-bold cursor-pointer disabled:cursor-not-allowed disabled:opacity-60',
  primary: 'bg-ink text-paper hover:bg-blue',
  secondary: 'bg-paper text-ink border border-line hover:border-ink',
};

export const Button = ({children, onClick, variant = 'secondary', disabled = false, title}: ButtonProps) => (
  <button type="button" className={`${styles.base} ${styles[variant]}`} onClick={onClick} disabled={disabled} title={title}>
    {children}
  </button>
);
