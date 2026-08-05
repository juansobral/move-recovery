import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// El HTML estático dejaba que el navegador saltara a #hash solo; en la SPA el
// contenido todavía no existe en el primer render, así que hay que esperarlo.
export function useAnchorScroll(): void {
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    const id = hash.slice(1);
    const raf = requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(raf);
  }, [hash]);
}
