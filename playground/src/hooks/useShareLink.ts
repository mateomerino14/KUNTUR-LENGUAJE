import {useCallback, useState} from 'react';
import {shareUrl, type SharedProgram} from '../utils/shareCode';

const messageDurationMs = 2500;

export const useShareLink = () => {
  const [message, setMessage] = useState<string | null>(null);

  const share = useCallback(async (program: SharedProgram) => {
    const url = shareUrl(window.location, program);
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
