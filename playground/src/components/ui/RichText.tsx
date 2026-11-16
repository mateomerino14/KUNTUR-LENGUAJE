interface RichTextProps {
  text: string;
}

const styles = {
  code: 'font-mono text-[0.92em] bg-paper border border-line rounded px-[5px] py-[1px]',
};

export const RichText = ({text}: RichTextProps) => (
  <>
    {text.split('`').map((part, index) => (index % 2 === 1 ? <code key={index} className={styles.code}>{part}</code> : part))}
  </>
);
