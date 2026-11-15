import {useCallback, useEffect, useRef, useState, type KeyboardEvent} from 'react';

interface UseListboxOptions {
  count: number;
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export const useListbox = ({count, selectedIndex, onSelect}: UseListboxOptions) => {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const container = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);

  const openList = useCallback(() => {
    setActiveIndex(Math.max(selectedIndex, 0));
    setOpen(true);
  }, [selectedIndex]);

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) {
      button.current?.focus();
    }
  }, []);

  const choose = useCallback((index: number) => {
    onSelect(index);
    close(true);
  }, [onSelect, close]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    list.current?.focus();
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [open]);

  useEffect(() => {
    if (open) {
      list.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({block: 'nearest'});
    }
  }, [open, activeIndex]);

  const onButtonKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      openList();
    }
  };

  const onListKeyDown = (event: KeyboardEvent) => {
    const moves: Record<string, number> = {
      ArrowDown: Math.min(activeIndex + 1, count - 1),
      ArrowUp: Math.max(activeIndex - 1, 0),
      Home: 0,
      End: count - 1,
    };
    if (event.key in moves) {
      event.preventDefault();
      setActiveIndex(moves[event.key]);
    }
    else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      choose(activeIndex);
    }
    else if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
    }
    else if (event.key === 'Tab') {
      close(false);
    }
  };

  const toggle = () => {
    if (open) {
      close(true);
    }
    else {
      openList();
    }
  };

  return {open, activeIndex, setActiveIndex, container, button, list, toggle, choose, onButtonKeyDown, onListKeyDown};
};
