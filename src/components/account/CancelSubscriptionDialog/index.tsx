import { useState, type MouseEvent } from 'react';
import { useCancelSubscriptionMutation } from '../../../features/api/userApi';
import { extractApiErrorMessage } from '../../../lib/apiError';
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

interface CancelSubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPeriodEnd: string;
}

export const CancelSubscriptionDialog = ({ open, onOpenChange, currentPeriodEnd }: CancelSubscriptionDialogProps): JSX.Element => {
  const [cancelSubscription, { isLoading }] = useCancelSubscriptionMutation();
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async (event: MouseEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await cancelSubscription().unwrap();
      onOpenChange(false);
    } catch (err) {
      setError(extractApiErrorMessage(err));
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar suscripción</AlertDialogTitle>
          <AlertDialogDescription>
            No se te va a cobrar de nuevo. Vas a poder seguir usando tus sesiones restantes hasta el {currentPeriodEnd}.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel>Volver</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? 'Cancelando…' : 'Cancelar suscripción'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
