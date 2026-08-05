import { cn } from '../../../lib/cn';
import { fmtTime } from '../../../lib/dateUtils';

interface SelectedSlotSummaryProps {
  date: string;
  selectedTime: string | null;
}

export const SelectedSlotSummary = ({ date, selectedTime }: SelectedSlotSummaryProps): JSX.Element => (
  <div
    className={cn(
      'my-1 mb-[18px] rounded-lg border border-dashed border-border px-3.5 py-3 text-sm text-muted-foreground',
      selectedTime && 'border-solid border-white text-foreground',
    )}
  >
    {selectedTime ? `${date} · ${fmtTime(selectedTime)}` : 'Ningún horario seleccionado'}
  </div>
);
