import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

export const NotFoundPage = (): JSX.Element => {
  useDocumentTitle('Página no encontrada · MOVE®');

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <p className="font-heading text-6xl font-black">404</p>
      <p className="text-muted-foreground">Esta página no existe.</p>
      <Link to="/" className="underline">
        Volver al inicio
      </Link>
    </div>
  );
};
