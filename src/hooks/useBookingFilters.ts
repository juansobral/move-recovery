import { useMemo, useState } from 'react';
import { addDays, todayStr } from '../lib/dateUtils';
import type { Booking } from '../types/booking.types';

export type RangeOption = 'upcoming' | 'today' | 'week' | 'past' | 'all';
export type SortKey = 'date' | 'name' | 'service';

export interface BookingFilters {
  q: string;
  range: RangeOption;
  service: string;
  exactDate: string;
}

const DEFAULT_FILTERS: BookingFilters = { q: '', range: 'upcoming', service: '', exactDate: '' };

export function useBookingStats(all: Booking[]) {
  return useMemo(() => {
    const hoy = todayStr();
    const deHoy = all.filter((b) => b.date === hoy);
    const semana = all.filter((b) => b.date >= hoy && b.date <= addDays(hoy, 7));
    const proximas = all.filter((b) => b.date >= hoy);

    return {
      hoy: { count: deHoy.length, hint: deHoy.length ? `Primera ${[...deHoy].sort((a, b) => a.time.localeCompare(b.time))[0].time} h` : 'Sin turnos' },
      // 9 slots/día × 7 días = 63 bloques posibles por semana.
      semana: { count: semana.length, hint: `${((semana.length / 63) * 100).toFixed(0)}% de ocupación` },
      proximas: { count: proximas.length, hint: 'Turnos por delante' },
      total: { count: all.length, hint: 'Reservas registradas' },
    };
  }, [all]);
}

export function useFilteredBookings(all: Booking[]) {
  const [filters, setFilters] = useState<BookingFilters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<{ by: SortKey; dir: 'asc' | 'desc' }>({ by: 'date', dir: 'asc' });

  const servicios = useMemo(() => [...new Set(all.map((b) => b.service))].sort(), [all]);

  const rows = useMemo(() => {
    const hoy = todayStr();
    let filtered = all.filter((b) => {
      if (filters.service && b.service !== filters.service) return false;
      if (filters.exactDate) return b.date === filters.exactDate;
      if (filters.range === 'today' && b.date !== hoy) return false;
      if (filters.range === 'upcoming' && b.date < hoy) return false;
      if (filters.range === 'past' && b.date >= hoy) return false;
      if (filters.range === 'week' && (b.date < hoy || b.date > addDays(hoy, 7))) return false;
      if (filters.q) {
        const haystack = `${b.name} ${b.email} ${b.phone} ${b.notes ?? ''}`.toLowerCase();
        if (!haystack.includes(filters.q.toLowerCase())) return false;
      }
      return true;
    });

    const dir = sort.dir === 'asc' ? 1 : -1;
    filtered = [...filtered].sort((a, b) =>
      sort.by === 'date'
        ? `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`) * dir
        : String(a[sort.by] ?? '').localeCompare(String(b[sort.by] ?? ''), 'es') * dir,
    );
    return filtered;
  }, [all, filters, sort]);

  const toggleSort = (by: SortKey) => {
    setSort((prev) => (prev.by === by ? { by, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { by, dir: 'asc' }));
  };

  const clearFilters = () => setFilters(DEFAULT_FILTERS);

  return { filters, setFilters, sort, toggleSort, rows, servicios, clearFilters };
}
