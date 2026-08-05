import type { BookingFilters, RangeOption } from '../../../hooks/useBookingFilters';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';

const RANGE_OPTIONS: Array<{ value: RangeOption; label: string }> = [
  { value: 'upcoming', label: 'Próximas' },
  { value: 'today', label: 'Hoy' },
  { value: 'week', label: 'Próximos 7 días' },
  { value: 'past', label: 'Pasadas' },
  { value: 'all', label: 'Todas' },
];

interface FilterToolbarProps {
  filters: BookingFilters;
  onFiltersChange: (filters: BookingFilters) => void;
  servicios: string[];
  onClear: () => void;
}

export const FilterToolbar = ({ filters, onFiltersChange, servicios, onClear }: FilterToolbarProps): JSX.Element => (
  <div className="flex flex-wrap items-end gap-4 rounded-lg border border-border bg-card p-5">
    <div className="min-w-[200px] flex-1">
      <Label htmlFor="filter-q">Buscar</Label>
      <Input
        id="filter-q"
        type="search"
        placeholder="Nombre, email o teléfono"
        value={filters.q}
        onChange={(e) => onFiltersChange({ ...filters, q: e.target.value })}
      />
    </div>

    <div className="w-[170px]">
      <Label htmlFor="filter-range">Período</Label>
      <Select value={filters.range} onValueChange={(range) => onFiltersChange({ ...filters, range: range as RangeOption })}>
        <SelectTrigger id="filter-range">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {RANGE_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>

    <div className="w-[190px]">
      <Label htmlFor="filter-service">Servicio</Label>
      <Select value={filters.service || '__all__'} onValueChange={(service) => onFiltersChange({ ...filters, service: service === '__all__' ? '' : service })}>
        <SelectTrigger id="filter-service">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Todos</SelectItem>
          {servicios.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>

    <div className="w-[160px]">
      <Label htmlFor="filter-day">Fecha exacta</Label>
      <input
        id="filter-day"
        type="date"
        value={filters.exactDate}
        onChange={(e) => onFiltersChange({ ...filters, exactDate: e.target.value })}
        className="w-full rounded-lg border border-input bg-black px-[14px] py-[13px] text-[15px] text-foreground [color-scheme:dark] focus-visible:outline-none focus-visible:border-white"
      />
    </div>

    <Button type="button" variant="ghost" size="sm" onClick={onClear}>
      Limpiar
    </Button>
  </div>
);
