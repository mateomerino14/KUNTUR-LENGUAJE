import {useCallback, useState} from 'react';
import {shareUrl} from '../utils/shareCode';

const messageDurationMs = 2500;

export const useShareLink = () => {
  const [message, setMessage] = useState<string | null>(null);

  const share = useCallback(async (source: string) => {
    const url = shareUrl(window.location, source);
    window.history.replaceState(null, '', url);
    try {
      await navigator.clipboard.writeText(url);
      setMessage('Enlace copiado');
    }
    catch {
      setMessage('Copia el enlace desde la barra de direcciones');
    }
    window.setTimeout(() => setMessage(null), messageDurationMs);
  }, []);

  return {share, message};
};
