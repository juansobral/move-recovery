import { useState, type MouseEvent } from 'react';
import { useCancelBookingMutation } from '../../../features/api/bookingsApi';
import { extractApiErrorMessage } from '../../../lib/apiError';
import { fechaCorta } from '../../../lib/dateUtils';
import type { Booking } from '../../../types/booking.types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../ui/alert-dialog';
import { Checkbox } from '../../ui/checkbox';
import { Label } from '../../ui/label';

interface CancelBookingDialogProps {
  booking: Booking | null;
  onOpenChange: (open: boolean) => void;
}

export const CancelBookingDialog = ({ booking, onOpenChange }: CancelBookingDialogProps): JSX.Element => {
  const [notify, setNotify] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelBooking, { isLoading }] = useCancelBookingMutation();

  // Radix cierra el AlertDialog automáticamente al hacer click en Action, salvo
  // que se llame preventDefault — lo hacemos siempre y cerramos "a mano" solo
  // si la cancelación fue exitosa, para poder mostrar el error sin que se cierre.
  const handleConfirm = async (event: MouseEvent) => {
    event.preventDefault();
    if (!booking) return;
    setError(null);
    try {
      await cancelBooking({ id: booking.id, notify }).unwrap();
      onOpenChange(false);
    } catch (err) {
      setError(extractApiErrorMessage(err));
    }
  };

  return (
    <AlertDialog open={Boolean(booking)} onOpenChange={(open) => !open && onOpenChange(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar reserva</AlertDialogTitle>
          {booking && (
            <AlertDialogDescription>
              Vas a cancelar el turno de <strong className="text-foreground">{booking.name}</strong> del{' '}
              <strong className="text-foreground">
                {fechaCorta(booking.date)} a las {booking.time} h
              </strong>{' '}
              ({booking.service}). El bloque queda libre para que otra persona lo reserve. Esta acción no se puede
              deshacer.
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>

        <div className="flex items-center gap-2">
          <Checkbox id="notify-client" checked={notify} onCheckedChange={(checked) => setNotify(checked === true)} />
          <Label htmlFor="notify-client" className="mb-0 normal-case tracking-normal text-foreground">
            Avisarle al cliente por email
          </Label>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <AlertDialogFooter>
          <AlertDialogCancel>Volver</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? 'Cancelando…' : 'Cancelar reserva'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
