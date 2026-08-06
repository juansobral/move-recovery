import { useState } from 'react';
import { extractApiErrorMessage } from '../../../lib/apiError';
import { Button } from '../../ui/button';
import { Textarea } from '../../ui/textarea';

// Mirror de server/src/catalog/catalog.constants.ts (RESET_SESSION_PRICE/PLANS)
// — el precio real cobrado siempre se calcula en el servidor, esto es solo
// para mostrar el monto correcto antes de que el cliente haga click.
const RESET_SESSION_PRICE = { regular: 600, socio: 300 };
const PLAN_PRICES = {
  standard: { regular: 2400, socio: 1200 },
  premium: { regular: 3840, socio: 1920 },
};

interface PaymentChoiceProps {
  isSocio: boolean;
  hasActivePlan: boolean;
  onPayOneOff: (notes: string) => Promise<unknown>;
  onSubscribe: (plan: 'standard' | 'premium', notes: string) => Promise<void>;
}

export const PaymentChoice = ({ isSocio, hasActivePlan, onPayOneOff, onSubscribe }: PaymentChoiceProps): JSX.Element => {
  const resetSessionPrice = isSocio ? RESET_SESSION_PRICE.socio : RESET_SESSION_PRICE.regular;
  const standardPrice = isSocio ? PLAN_PRICES.standard.socio : PLAN_PRICES.standard.regular;
  const premiumPrice = isSocio ? PLAN_PRICES.premium.socio : PLAN_PRICES.premium.regular;
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

      <Button type="button" size="block" disabled={isLoading !== null} onClick={() => run('oneoff', () => onPayOneOff(notes))}>
        {isLoading === 'oneoff' ? 'Redirigiendo…' : `Pagar $${resetSessionPrice} (esta sesión)`}
      </Button>

      {!hasActivePlan && (
        <>
          <Button
            type="button"
            variant="ghost"
            size="block"
            disabled={isLoading !== null}
            onClick={() => run('standard', () => onSubscribe('standard', notes))}
          >
            {isLoading === 'standard' ? 'Redirigiendo…' : `Suscribirme a Standard Reset ($${standardPrice}/mes · 4 sesiones)`}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="block"
            disabled={isLoading !== null}
            onClick={() => run('premium', () => onSubscribe('premium', notes))}
          >
            {isLoading === 'premium' ? 'Redirigiendo…' : `Suscribirme a Premium Reset ($${premiumPrice}/mes · 8 sesiones)`}
          </Button>
        </>
      )}

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
};
