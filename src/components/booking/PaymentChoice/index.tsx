import { useState } from 'react';
import { extractApiErrorMessage } from '../../../lib/apiError';
import type { PricingConfig } from '../../../types/booking.types';
import { Button } from '../../ui/button';
import { Textarea } from '../../ui/textarea';

interface PaymentChoiceProps {
  isSocio: boolean;
  hasActivePlan: boolean;
  pricing: PricingConfig | undefined;
  onPayOneOff: (notes: string) => Promise<unknown>;
  onSubscribe: (plan: 'standard' | 'premium', notes: string) => Promise<void>;
}

export const PaymentChoice = ({ isSocio, hasActivePlan, pricing, onPayOneOff, onSubscribe }: PaymentChoiceProps): JSX.Element => {
  const resetSessionPrice = isSocio ? pricing?.resetSessionPriceSocioUyu : pricing?.resetSessionPriceUyu;
  const standardPrice = isSocio ? pricing?.standardPriceSocioUyu : pricing?.standardPriceUyu;
  const premiumPrice = isSocio ? pricing?.premiumPriceSocioUyu : pricing?.premiumPriceUyu;
  const [isLoading, setIsLoading] = useState<'oneoff' | 'standard' | 'premium' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const run = async (key: 'oneoff' | 'standard' | 'premium', action: () => Promise<unknown>) => {
    setIsLoading(key);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(extractApiErrorMessage(err));
      setIsLoading(null);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-7">
      <h3 className="mb-2 text-lg uppercase tracking-wide">
        {hasActivePlan ? 'Ya usaste tus sesiones de este mes' : 'No tenés un plan activo'}
      </h3>
      <p className="mb-4 text-sm text-muted-foreground">
        {hasActivePlan
          ? 'Podés pagar esta sesión aparte — tu plan se renueva automáticamente el próximo mes.'
          : 'Elegí cómo querés pagar esta sesión.'}
      </p>

      <Textarea
        rows={2}
        placeholder="Notas (opcional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="mb-3"
      />

      <Button type="button" size="block" disabled={isLoading !== null || !pricing} onClick={() => run('oneoff', () => onPayOneOff(notes))}>
        {isLoading === 'oneoff' ? 'Redirigiendo…' : `Pagar $${resetSessionPrice ?? '…'} (esta sesión)`}
      </Button>

      {!hasActivePlan && (
        <>
          <Button
            type="button"
            variant="ghost"
            size="block"
            disabled={isLoading !== null || !pricing}
            onClick={() => run('standard', () => onSubscribe('standard', notes))}
          >
            {isLoading === 'standard' ? 'Redirigiendo…' : `Suscribirme a Standard Reset ($${standardPrice ?? '…'}/mes · 4 sesiones)`}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="block"
            disabled={isLoading !== null || !pricing}
            onClick={() => run('premium', () => onSubscribe('premium', notes))}
          >
            {isLoading === 'premium' ? 'Redirigiendo…' : `Suscribirme a Premium Reset ($${premiumPrice ?? '…'}/mes · 8 sesiones)`}
          </Button>
        </>
      )}

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
};
