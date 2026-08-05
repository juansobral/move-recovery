import { useEffect, useRef } from 'react';

// Tipado mínimo de lo que realmente usamos del SDK de Google Identity
// Services (no hay @types oficial liviano para esto).
interface GoogleCredentialResponse {
  credential: string;
}
interface GoogleIdApi {
  initialize(config: { client_id: string; callback: (response: GoogleCredentialResponse) => void }): void;
  renderButton(parent: HTMLElement, options: { theme: 'outline' | 'filled_black'; size: 'large' | 'medium'; text: 'signin_with' }): void;
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdApi } };
  }
}

interface GoogleSignInButtonProps {
  onCredential: (idToken: string) => void;
}

export const GoogleSignInButton = ({ onCredential }: GoogleSignInButtonProps): JSX.Element => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    let cancelled = false;

    const tryRender = () => {
      if (cancelled || !containerRef.current) return;
      if (!window.google) {
        setTimeout(tryRender, 100); // el script de Google carga async; reintenta hasta que esté listo
        return;
      }
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => onCredential(response.credential),
      });
      window.google.accounts.id.renderButton(containerRef.current, { theme: 'outline', size: 'large', text: 'signin_with' });
    };

    tryRender();
    return () => {
      cancelled = true;
    };
  }, [onCredential]);

  return <div ref={containerRef} />;
};
