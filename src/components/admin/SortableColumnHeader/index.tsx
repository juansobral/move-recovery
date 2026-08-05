import type { SortKey } from '../../../hooks/useBookingFilters';

interface SortableColumnHeaderProps {
  label: string;
  sortKey: SortKey;
  currentSort: { by: SortKey; dir: 'asc' | 'desc' };
  onSort: (key: SortKey) => void;
}

export const SortableColumnHeader = ({ label, sortKey, currentSort, onSort }: SortableColumnHeaderProps): JSX.Element => (
  <th className="cursor-pointer select-none px-4 py-3 text-left text-xs uppercase tracking-wide text-muted-foreground" onClick={() => onSort(sortKey)}>
    {label}
    {currentSort.by === sortKey && <span className="ml-1">{currentSort.dir === 'asc' ? '▲' : '▼'}</span>}
  </th>
);
