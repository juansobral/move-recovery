import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLazyGetCheckoutStatusQuery } from '../../features/api/userApi';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

const POLL_INTERVAL_MS = 5000;
const MAX_ATTEMPTS = 30; // ~2.5 minutos

export const CheckoutPendingPage = (): JSX.Element => {
  useDocumentTitle('Confirmando tu pago · MOVE®');
  const [searchParams] = useSearchParams();
  const ref = searchParams.get('ref') ?? '';
  const failed = searchParams.get('failed') === '1';
  const [trigger, { data }] = useLazyGetCheckoutStatusQuery();
  const [attempts, setAttempts] = useState(0);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!ref || failed || data?.status === 'completed' || data?.status === 'invalid') return;
    if (attempts >= MAX_ATTEMPTS) {
      setTimedOut(true);
      return;
    }
    const timer = setTimeout(() => {
      trigger(ref);
      setAttempts((a) => a + 1);
    }, POLL_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [ref, failed, data, attempts, trigger]);

  if (failed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-5 text-center">
        <p className="font-heading text-xl uppercase tracking-wide">El pago no se pudo completar</p>
        <p className="text-muted-foreground">Podés intentar de nuevo desde la sección de reservas.</p>
        <Link to="/#reservar" className="underline">Volver a reservar</Link>
      </div>
    );
  }

  if (data?.status === 'completed') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-5 text-center">
        <p className="font-heading text-xl uppercase tracking-wide text-success">¡Listo!</p>
        <p className="text-muted-foreground">Tu reserva quedó confirmada.</p>
        <Link to="/mi-cuenta" className="underline">Ver mi cuenta</Link>
      </div>
    );
  }

  if (data?.status === 'invalid' || timedOut) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-5 text-center">
        <p className="font-heading text-xl uppercase tracking-wide">No pudimos confirmar automáticamente</p>
        <p className="text-muted-foreground">Si ya pagaste, revisá tu email — te va a llegar la confirmación en cuanto se procese. Si algo no cierra, escribinos.</p>
        <Link to="/mi-cuenta" className="underline">Ver mi cuenta</Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-5 text-center">
      <p className="font-heading text-xl uppercase tracking-wide">Confirmando tu pago…</p>
      <p className="text-muted-foreground">Esto puede tardar unos segundos.</p>
    </div>
  );
};
