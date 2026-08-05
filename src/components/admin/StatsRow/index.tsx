import { useBookingStats } from '../../../hooks/useBookingFilters';
import type { Booking } from '../../../types/booking.types';
import { StatTile } from '../StatTile';

interface StatsRowProps {
  bookings: Booking[];
}

export const StatsRow = ({ bookings }: StatsRowProps): JSX.Element => {
  const stats = useBookingStats(bookings);

  return (
    <div className="grid gap-4 max-md:grid-cols-2 md:grid-cols-4">
      <StatTile label="Hoy" value={stats.hoy.count} hint={stats.hoy.hint} />
      <StatTile label="Próximos 7 días" value={stats.semana.count} hint={stats.semana.hint} />
      <StatTile label="Próximas" value={stats.proximas.count} hint={stats.proximas.hint} />
      <StatTile label="Total histórico" value={stats.total.count} hint={stats.total.hint} />
    </div>
  );
};
