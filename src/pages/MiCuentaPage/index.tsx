import { useMemo } from 'react';
import { useGetMeQuery, useGetMyBookingsQuery } from '../../features/api/userApi';
import { fechaCorta, todayStr } from '../../lib/dateUtils';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { Badge } from '../../components/ui/badge';
import { Card } from '../../components/ui/card';

export const MiCuentaPage = (): JSX.Element => {
  useDocumentTitle('Mi cuenta · MOVE®');
  const { data: me } = useGetMeQuery();
  const { data: bookings = [] } = useGetMyBookingsQuery();

  const { upcoming, past } = useMemo(() => {
    const hoy = todayStr();
    return {
      upcoming: bookings.filter((b) => b.date >= hoy).sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)),
      past: bookings.filter((b) => b.date < hoy).sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)),
    };
  }, [bookings]);

  return (
    <div className="mx-auto max-w-site space-y-8 px-8 py-12 max-md:px-5">
      <div>
        <h1 className="font-heading text-2xl uppercase tracking-wide">Hola, {me?.name?.split(' ')[0]}</h1>
        <p className="text-sm text-muted-foreground">{me?.email}</p>
      </div>

      <Card className="p-6">
        <h2 className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Tu plan</h2>
        <p className="text-foreground">Sin plan activo todavía.</p>
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
              <Badge>{b.service}</Badge>
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
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
