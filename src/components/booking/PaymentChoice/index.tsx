import { useState } from 'react';
import { extractApiErrorMessage } from '../../../lib/apiError';
import { Button } from '../../ui/button';

interface PaymentChoiceProps {
  resetSessionPrice: number;
  onPayOneOff: () => Promise<unknown>;
  onSubscribe: (plan: 'standard' | 'premium') => Promise<void>;
}

export const PaymentChoice = ({ resetSessionPrice, onPayOneOff, onSubscribe }: PaymentChoiceProps): JSX.Element => {
  const [isLoading, setIsLoading] = useState<'oneoff' | 'standard' | 'premium' | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      <h3 className="mb-2 text-lg uppercase tracking-wide">No tenés un plan activo</h3>
      <p className="mb-4 text-sm text-muted-foreground">Elegí cómo querés pagar esta sesión.</p>

      <Button type="button" size="block" disabled={isLoading !== null} onClick={() => run('oneoff', onPayOneOff)}>
        {isLoading === 'oneoff' ? 'Redirigiendo…' : `Pagar $${resetSessionPrice} (esta sesión)`}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="block"
        disabled={isLoading !== null}
        onClick={() => run('standard', () => onSubscribe('standard'))}
      >
        {isLoading === 'standard' ? 'Redirigiendo…' : 'Suscribirme a Standard Reset ($2400/mes · 4 sesiones)'}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="block"
        disabled={isLoading !== null}
        onClick={() => run('premium', () => onSubscribe('premium'))}
      >
        {isLoading === 'premium' ? 'Redirigiendo…' : 'Suscribirme a Premium Reset ($3840/mes · 8 sesiones)'}
      </Button>

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
};
