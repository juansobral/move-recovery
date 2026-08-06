import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useGetMeQuery, useGetMyBookingsQuery, useGetMySubscriptionQuery } from '../../features/api/userApi';
import { loggedOut } from '../../features/userAuth/userAuthSlice';
import { fechaCorta, todayStr } from '../../lib/dateUtils';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useAppDispatch } from '../../store/hooks';
import type { Booking } from '../../types/booking.types';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { CancelSubscriptionDialog } from '../../components/account/CancelSubscriptionDialog';

export const MiCuentaPage = (): JSX.Element => {
  useDocumentTitle('Mi cuenta · MOVE®');
  const dispatch = useAppDispatch();
  const { data: me } = useGetMeQuery();
  const { data: bookings = [] } = useGetMyBookingsQuery();
  const { data: subscription } = useGetMySubscriptionQuery();
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const { upcoming, past } = useMemo(() => {
    const hoy = todayStr();
    return {
      upcoming: bookings.filter((b) => b.date >= hoy).sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)),
      past: bookings.filter((b) => b.date < hoy).sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)),
    };
  }, [bookings]);

  // Reservas pagadas (mpPaymentId) vs. reclamadas con un crédito del plan —
  // a estas últimas se les numera según el orden cronológico dentro del
  // ciclo de facturación vigente (los créditos se resetean cada ciclo).
  const sessionLabelById = useMemo(() => {
    const labels = new Map<number, string>();
    bookings
      .filter((b) => !b.mpPaymentId && (!subscription || b.date >= subscription.currentPeriodStart))
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
      .forEach((b, i) => labels.set(b.id, `Sesión ${i + 1} del plan`));
    return labels;
  }, [bookings, subscription]);

  const bookingBadge = (b: Booking): string | null => {
    if (b.mpPaymentId) return 'Pagada';
    return sessionLabelById.get(b.id) ?? null;
  };

  return (
    <div className="mx-auto max-w-site space-y-8 px-8 py-12 max-md:px-5">
      <div className="flex items-start justify-between gap-4 max-md:flex-col">
        <div>
          <h1 className="font-heading text-2xl uppercase tracking-wide">Hola, {me?.name?.split(' ')[0]}</h1>
          <p className="text-sm text-muted-foreground">{me?.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/">Volver al inicio</Link>
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => dispatch(loggedOut())}>
            Cerrar sesión
          </Button>
        </div>
      </div>

      <Card className="p-6">
        <h2 className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Tu plan</h2>
        {subscription ? (
          <div className="space-y-2">
            <p className="text-foreground">
              {subscription.plan === 'standard' ? 'Standard Reset' : 'Premium Reset'} — {subscription.sessionCreditsRemaining} de{' '}
              {subscription.sessionCreditsTotal} sesiones restantes este mes
            </p>
            <p className="text-sm text-muted-foreground">Vence el {subscription.currentPeriodEnd}</p>
            {subscription.status === 'authorized' && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setCancelDialogOpen(true)}>
                Cancelar suscripción
              </Button>
            )}
            <CancelSubscriptionDialog
              open={cancelDialogOpen}
              onOpenChange={setCancelDialogOpen}
              currentPeriodEnd={subscription.currentPeriodEnd}
            />
          </div>
        ) : (
          <p className="text-foreground">Sin plan activo todavía.</p>
        )}
      </Card>

      <div>
        <h2 className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">Próximas reservas</h2>
        {upcoming.length === 0 && <p className="text-sm text-muted-foreground">No tenés reservas próximas.</p>}
        <div className="space-y-2">
          {upcoming.map((b) => (
            <Card key={b.id} className="flex items-center justify-between p-4">
              <div>
                <p>{fechaCorta(b.date)} · {b.time} h</p>
                <p className="text-xs text-muted-foreground">{b.service}</p>
              </div>
              {bookingBadge(b) && <Badge highlighted={Boolean(b.mpPaymentId)}>{bookingBadge(b)}</Badge>}
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">Reservas pasadas</h2>
        {past.length === 0 && <p className="text-sm text-muted-foreground">Todavía no tenés reservas pasadas.</p>}
        <div className="space-y-2 opacity-60">
          {past.map((b) => (
            <Card key={b.id} className="flex items-center justify-between p-4">
              <div>
                <p>{fechaCorta(b.date)} · {b.time} h</p>
                <p className="text-xs text-muted-foreground">{b.service}</p>
              </div>
              {bookingBadge(b) && <Badge highlighted={Boolean(b.mpPaymentId)}>{bookingBadge(b)}</Badge>}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
