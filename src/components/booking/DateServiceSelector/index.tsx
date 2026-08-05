import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { todayStr } from '../../../lib/dateUtils';

interface DateServiceSelectorProps {
  date: string;
  onDateChange: (date: string) => void;
  service: string;
  onServiceChange: (service: string) => void;
  servicios: string[];
}

export const DateServiceSelector = ({ date, onDateChange, service, onServiceChange, servicios }: DateServiceSelectorProps): JSX.Element => (
  <div className="mb-4 space-y-4">
    <div>
      <Label htmlFor="booking-date">Fecha</Label>
      <input
        id="booking-date"
        type="date"
        min={todayStr()}
        value={date}
        onChange={(e) => onDateChange(e.target.value)}
        className="w-full rounded-lg border border-input bg-black px-[14px] py-[13px] text-[15px] text-foreground [color-scheme:dark] focus-visible:outline-none focus-visible:border-white"
      />
    </div>
    <div>
      <Label htmlFor="booking-service">Servicio</Label>
      <Select value={service} onValueChange={onServiceChange}>
        <SelectTrigger id="booking-service">
          <SelectValue placeholder="Elegí un servicio" />
        </SelectTrigger>
        <SelectContent>
          {servicios.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  </div>
);
