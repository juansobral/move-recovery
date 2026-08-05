import { cn } from '../../../lib/cn';
import { fmtTime } from '../../../lib/dateUtils';

interface SlotButtonProps {
  time: string;
  available: boolean;
  selected: boolean;
  onSelect: () => void;
}

export const SlotButton = ({ time, available, selected, onSelect }: SlotButtonProps): JSX.Element => (
  <button
    type="button"
    disabled={!available}
    title={available ? fmtTime(time) : 'No disponible'}
    onClick={onSelect}
    className={cn(
      'rounded-lg border border-input bg-black px-1.5 py-[13px] font-heading text-sm font-semibold tracking-wide text-foreground transition-colors',
      'disabled:cursor-not-allowed disabled:opacity-[0.28] disabled:line-through',
      !selected && available && 'hover:border-white',
      selected && 'border-white bg-white text-black',
    )}
  >
    {time}
  </button>
);
