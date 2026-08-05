import type { AvailabilitySlot } from '../../../types/booking.types';
import { SlotButton } from '../SlotButton';

interface SlotGridProps {
  slots: AvailabilitySlot[];
  selectedTime: string | null;
  onSelect: (time: string) => void;
  isLoading: boolean;
}

export const SlotGrid = ({ slots, selectedTime, onSelect, isLoading }: SlotGridProps): JSX.Element => {
  if (isLoading) return <p className="col-span-full text-sm text-muted-foreground">Cargando disponibilidad…</p>;

  if (slots.length === 0) {
    return <p className="col-span-full text-sm text-muted-foreground">Seleccioná una fecha para ver la disponibilidad.</p>;
  }

  if (slots.every((s) => !s.available)) {
    return <p className="col-span-full text-sm text-muted-foreground">Sin horarios disponibles para esta fecha.</p>;
  }

  return (
    <div className="grid grid-cols-3 gap-2.5">
      {slots.map((s) => (
        <SlotButton key={s.time} time={s.time} available={s.available} selected={selectedTime === s.time} onSelect={() => onSelect(s.time)} />
      ))}
    </div>
  );
};
