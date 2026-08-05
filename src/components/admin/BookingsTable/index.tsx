import type { SortKey } from '../../../hooks/useBookingFilters';
import { fechaCorta, todayStr } from '../../../lib/dateUtils';
import type { Booking } from '../../../types/booking.types';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { SortableColumnHeader } from '../SortableColumnHeader';

interface BookingsTableProps {
  rows: Booking[];
  total: number;
  sort: { by: SortKey; dir: 'asc' | 'desc' };
  onSort: (key: SortKey) => void;
  onCancel: (booking: Booking) => void;
}

export const BookingsTable = ({ rows, total, sort, onSort, onCancel }: BookingsTableProps): JSX.Element => {
  const hoy = todayStr();

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead className="border-b border-border">
          <tr>
            <SortableColumnHeader label="Fecha / Hora" sortKey="date" currentSort={sort} onSort={onSort} />
            <SortableColumnHeader label="Cliente" sortKey="name" currentSort={sort} onSort={onSort} />
            <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-muted-foreground">Contacto</th>
            <SortableColumnHeader label="Servicio" sortKey="service" currentSort={sort} onSort={onSort} />
            <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-muted-foreground">Notas</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => {
            const tel = String(b.phone || '').replace(/[^\d]/g, '');
            return (
              <tr key={b.id} className={`border-b border-border last:border-b-0 ${b.date < hoy ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3">
                  <div>{fechaCorta(b.date)}</div>
                  <div className="text-xs text-muted-foreground">{b.time} h · 1 hora</div>
                </td>
                <td className="px-4 py-3">
                  <div>{b.name}</div>
                  <div className="text-xs text-muted-foreground">#{b.id}</div>
                </td>
                <td className="px-4 py-3">
                  <div>
                    <a href={`mailto:${b.email}`} className="hover:underline">
                      {b.email}
                    </a>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <a href={`https://wa.me/${tel}`} target="_blank" rel="noopener" className="hover:underline">
                      {b.phone}
                    </a>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge highlighted={b.date === hoy}>{b.service}</Badge>
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className={b.notes ? '' : 'text-muted-foreground'}>{b.notes || '—'}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button type="button" variant="danger" size="sm" onClick={() => onCancel(b)}>
                    Cancelar
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No hay reservas para este filtro.</p>}
      <p className="border-t border-border p-4 text-xs text-muted-foreground">
        Mostrando {rows.length} de {total} reservas · actualizado {new Date().toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>
  );
};
