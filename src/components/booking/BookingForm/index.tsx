import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { extractApiErrorMessage } from '../../../lib/apiError';
import { cn } from '../../../lib/cn';
import { clientFieldsSchema, type ClientFieldsValues } from '../../../schemas/booking.schema';
import type { CreateBookingResponse } from '../../../types/booking.types';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { SelectedSlotSummary } from '../SelectedSlotSummary';

interface BookingFormProps {
  date: string;
  selectedTime: string | null;
  isSubmitting: boolean;
  onSubmit: (values: ClientFieldsValues) => Promise<CreateBookingResponse>;
}

export const BookingForm = ({ date, selectedTime, isSubmitting, onSubmit }: BookingFormProps): JSX.Element => {
  const [message, setMessage] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = useForm<ClientFieldsValues>({ resolver: zodResolver(clientFieldsSchema), mode: 'onChange' });

  const submit = handleSubmit(async (values) => {
    setMessage(null);
    try {
      const result = await onSubmit(values);
      setMessage({
        kind: 'ok',
        text: result.emailSent
          ? `✓ Reserva confirmada: ${result.date} a las ${result.time}. Te enviamos un mail con el protocolo y qué llevar. ¡Te esperamos!`
          : `✓ Reserva confirmada: ${result.date} a las ${result.time}. ¡Te esperamos! (No pudimos enviarte el mail con el protocolo; te escribimos por WhatsApp.)`,
      });
      reset();
    } catch (err) {
      setMessage({ kind: 'err', text: extractApiErrorMessage(err) });
    }
  });

  return (
    <form onSubmit={submit} className="rounded-lg border border-border bg-card p-7">
      <h3 className="mb-[18px] text-lg uppercase tracking-wide">Tus datos</h3>

      <div className="mb-4">
        <Label htmlFor="booking-name">Nombre y apellido</Label>
        <Input id="booking-name" {...register('name')} />
        {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>}
      </div>

      <div className="mb-4">
        <Label htmlFor="booking-email">Email</Label>
        <Input id="booking-email" type="email" {...register('email')} />
        {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}
      </div>

      <div className="mb-4">
        <Label htmlFor="booking-phone">Teléfono / WhatsApp</Label>
        <Input id="booking-phone" type="tel" {...register('phone')} />
        {errors.phone && <p className="mt-1 text-xs text-destructive">{errors.phone.message}</p>}
      </div>

      <div className="mb-4">
        <Label htmlFor="booking-notes">Notas (opcional)</Label>
        <Textarea id="booking-notes" rows={2} {...register('notes')} />
      </div>

      <SelectedSlotSummary date={date} selectedTime={selectedTime} />

      <Button type="submit" size="block" disabled={!selectedTime || !isValid || isSubmitting}>
        {isSubmitting ? 'Enviando…' : 'Confirmar reserva'}
      </Button>

      {message && <p className={cn('mt-3.5 min-h-5 text-sm', message.kind === 'ok' ? 'text-success' : 'text-destructive')}>{message.text}</p>}
    </form>
  );
};
