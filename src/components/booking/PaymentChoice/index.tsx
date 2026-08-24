import { useState } from 'react';
import { extractApiErrorMessage } from '../../../lib/apiError';
import type { CreateBookingResponse, PricingConfig } from '../../../types/booking.types';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';

interface PaymentChoiceProps {
  isSocio: boolean;
  hasActivePlan: boolean;
  isFirstSession: boolean;
  pricing: PricingConfig | undefined;
  initialDiscountCode?: string | null;
  onPayOneOff: (notes: string) => Promise<unknown>;
  onRedeemFreeSession: (code: string, notes: string) => Promise<CreateBookingResponse>;
  onSubscribe: (plan: 'standard' | 'premium', notes: string) => Promise<void>;
}

export const PaymentChoice = ({
  isSocio,
  hasActivePlan,
  isFirstSession,
  pricing,
  initialDiscountCode,
  onPayOneOff,
  onRedeemFreeSession,
  onSubscribe,
}: PaymentChoiceProps): JSX.Element => {
  const resetSessionPrice = isFirstSession
    ? pricing?.firstSessionPriceUyu
    : isSocio
      ? pricing?.resetSessionPriceSocioUyu
      : pricing?.resetSessionPriceUyu;
  const standardPrice = isSocio ? pricing?.standardPriceSocioUyu : pricing?.standardPriceUyu;
  const premiumPrice = isSocio ? pricing?.premiumPriceSocioUyu : pricing?.premiumPriceUyu;
  const [isLoading, setIsLoading] = useState<'oneoff' | 'standard' | 'premium' | 'discount' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [discountCode, setDiscountCode] = useState(initialDiscountCode ?? '');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleRedeemCode = async () => {
    setIsLoading('discount');
    setError(null);
    setSuccessMessage(null);
    try {
      const result = await onRedeemFreeSession(discountCode, notes);
      setSuccessMessage(
        result.emailSent
          ? `✓ Reserva confirmada: ${result.date} a las ${result.time}. Te enviamos un mail con el protocolo y qué llevar. ¡Te esperamos!`
          : `✓ Reserva confirmada: ${result.date} a las ${result.time}. ¡Te esperamos! (No pudimos enviarte el mail con el protocolo; te escribimos por WhatsApp.)`,
      );
    } catch (err) {
      setError(extractApiErrorMessage(err));
    } finally {
      setIsLoading(null);
    }
  };

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

      {isSocio ? (
        <p className="mb-3 text-xs text-success">Precio socio aplicado (50% OFF).</p>
      ) : (
        <p className="mb-3 text-xs text-muted-foreground">Los socios de MOVE ahorran 50% en sesiones y planes.</p>
      )}

      <Textarea
        rows={2}
        placeholder="Notas (opcional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="mb-3"
      />

      {initialDiscountCode && (
        <div className="mb-3">
          <Label htmlFor="discount-code">Código de descuento</Label>
          <Input id="discount-code" value={discountCode} onChange={(e) => setDiscountCode(e.target.value)} />
          <Button
            type="button"
            variant="ghost"
            size="block"
            className="mt-2"
            disabled={isLoading !== null || !pricing || !discountCode}
            onClick={handleRedeemCode}
          >
            {isLoading === 'discount' ? 'Canjeando…' : 'Usar código (sesión gratis)'}
          </Button>
        </div>
      )}

      <Button type="button" size="block" disabled={isLoading !== null || !pricing} onClick={() => run('oneoff', () => onPayOneOff(notes))}>
        {isLoading === 'oneoff' ? 'Redirigiendo…' : `Pagar $${resetSessionPrice ?? '…'} (esta sesión)`}
      </Button>

      {!hasActivePlan && (
        <>
          <Button
            type="button"
            variant="ghost"
            size="block"
            className="whitespace-normal leading-snug"
            disabled={isLoading !== null || !pricing}
            onClick={() => run('standard', () => onSubscribe('standard', notes))}
          >
            {isLoading === 'standard' ? (
              'Redirigiendo…'
            ) : (
              <>
                Suscribirme a Standard Reset
                <br />
                {`($${standardPrice ?? '…'}/mes · 4 sesiones)`}
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="block"
            className="whitespace-normal leading-snug"
            disabled={isLoading !== null || !pricing}
            onClick={() => run('premium', () => onSubscribe('premium', notes))}
          >
            {isLoading === 'premium' ? (
              'Redirigiendo…'
            ) : (
              <>
                Suscribirme a Premium Reset
                <br />
                {`($${premiumPrice ?? '…'}/mes · 8 sesiones)`}
              </>
            )}
          </Button>
        </>
      )}

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      {successMessage && <p className="mt-2 text-sm text-success">{successMessage}</p>}
    </div>
  );
};
