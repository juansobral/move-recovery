import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { AdminTopNav } from '../../components/admin/AdminTopNav';
import { Button } from '../../components/ui/button';
import { Checkbox } from '../../components/ui/checkbox';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useGetAdminDiscountCodeQuery, useUpdateDiscountCodeMutation } from '../../features/api/discountCodeApi';
import { useGetAdminPricingQuery, useUpdatePricingMutation } from '../../features/api/pricingApi';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { extractApiErrorMessage } from '../../lib/apiError';
import { cn } from '../../lib/cn';
import { pricingSchema, type PricingFormValues } from '../../schemas/pricing.schema';

export const AdminPricingPage = (): JSX.Element => {
  useDocumentTitle('Precios · Admin · MOVE®');
  const { data: pricing, isFetching, refetch } = useGetAdminPricingQuery();
  const [updatePricing, { isLoading: isSaving }] = useUpdatePricingMutation();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const { data: discountCode, isFetching: isFetchingCode, refetch: refetchCode } = useGetAdminDiscountCodeQuery();
  const [updateDiscountCode, { isLoading: isSavingCode }] = useUpdateDiscountCodeMutation();
  const [codeValue, setCodeValue] = useState('');
  const [codeActive, setCodeActive] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeSaved, setCodeSaved] = useState(false);

  useEffect(() => {
    if (discountCode) {
      setCodeValue(discountCode.code);
      setCodeActive(discountCode.active);
    }
  }, [discountCode]);

  const submitDiscountCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setCodeError(null);
    setCodeSaved(false);
    try {
      await updateDiscountCode({ code: codeValue, active: codeActive }).unwrap();
      setCodeSaved(true);
    } catch (err) {
      setCodeError(extractApiErrorMessage(err));
    }
  };

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<PricingFormValues>({ resolver: zodResolver(pricingSchema) });

  useEffect(() => {
    if (pricing) reset(pricing);
  }, [pricing, reset]);

  const submit = handleSubmit(async (values) => {
    setError(null);
    setSaved(false);
    try {
      await updatePricing(values).unwrap();
      setSaved(true);
    } catch (err) {
      setError(extractApiErrorMessage(err));
    }
  });

  const discountPercent = (regular: unknown, socio: unknown): number | null => {
    const r = Number(regular);
    const s = Number(socio);
    if (!r || !s) return null;
    return Math.round((1 - s / r) * 100);
  };

  const standardRegular = useWatch({ control, name: 'standardPriceUyu' });
  const standardSocio = useWatch({ control, name: 'standardPriceSocioUyu' });
  const premiumRegular = useWatch({ control, name: 'premiumPriceUyu' });
  const premiumSocio = useWatch({ control, name: 'premiumPriceSocioUyu' });
  const resetRegular = useWatch({ control, name: 'resetSessionPriceUyu' });
  const resetSocio = useWatch({ control, name: 'resetSessionPriceSocioUyu' });

  const renderDiscountHint = (regular: unknown, socio: unknown): JSX.Element | null => {
    const pct = discountPercent(regular, socio);
    if (pct === null) return null;
    return <span className={cn('ml-2 text-xs', pct >= 45 && pct <= 55 ? 'text-success' : 'text-destructive')}>−{pct}%</span>;
  };

  return (
    <div>
      <AdminTopNav onReload={() => { refetch(); refetchCode(); }} isReloading={isFetching || isFetchingCode} />
      <main className="mx-auto max-w-site space-y-6 px-8 py-8 max-md:px-5">
        <h1 className="font-heading text-2xl uppercase tracking-wide">Precios</h1>

        <form onSubmit={submit} className="max-w-xl space-y-6 rounded-lg border border-border bg-card p-7">
          <fieldset className="space-y-3">
            <legend className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Standard Reset</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="standardPriceUyu">Precio regular</Label>
                <Input id="standardPriceUyu" type="number" {...register('standardPriceUyu')} />
                {errors.standardPriceUyu && <p className="mt-1 text-xs text-destructive">{errors.standardPriceUyu.message}</p>}
              </div>
              <div>
                <Label htmlFor="standardPriceSocioUyu">
                  Precio socio
                  {renderDiscountHint(standardRegular, standardSocio)}
                </Label>
                <Input id="standardPriceSocioUyu" type="number" {...register('standardPriceSocioUyu')} />
                {errors.standardPriceSocioUyu && <p className="mt-1 text-xs text-destructive">{errors.standardPriceSocioUyu.message}</p>}
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Premium Reset</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="premiumPriceUyu">Precio regular</Label>
                <Input id="premiumPriceUyu" type="number" {...register('premiumPriceUyu')} />
                {errors.premiumPriceUyu && <p className="mt-1 text-xs text-destructive">{errors.premiumPriceUyu.message}</p>}
              </div>
              <div>
                <Label htmlFor="premiumPriceSocioUyu">
                  Precio socio
                  {renderDiscountHint(premiumRegular, premiumSocio)}
                </Label>
                <Input id="premiumPriceSocioUyu" type="number" {...register('premiumPriceSocioUyu')} />
                {errors.premiumPriceSocioUyu && <p className="mt-1 text-xs text-destructive">{errors.premiumPriceSocioUyu.message}</p>}
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Sesión suelta (Reset Session)</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="resetSessionPriceUyu">Precio regular</Label>
                <Input id="resetSessionPriceUyu" type="number" {...register('resetSessionPriceUyu')} />
                {errors.resetSessionPriceUyu && <p className="mt-1 text-xs text-destructive">{errors.resetSessionPriceUyu.message}</p>}
              </div>
              <div>
                <Label htmlFor="resetSessionPriceSocioUyu">
                  Precio socio
                  {renderDiscountHint(resetRegular, resetSocio)}
                </Label>
                <Input id="resetSessionPriceSocioUyu" type="number" {...register('resetSessionPriceSocioUyu')} />
                {errors.resetSessionPriceSocioUyu && (
                  <p className="mt-1 text-xs text-destructive">{errors.resetSessionPriceSocioUyu.message}</p>
                )}
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Primera sesión (cliente nuevo)</legend>
            <div>
              <Label htmlFor="firstSessionPriceUyu">Precio</Label>
              <Input id="firstSessionPriceUyu" type="number" {...register('firstSessionPriceUyu')} />
              {errors.firstSessionPriceUyu && <p className="mt-1 text-xs text-destructive">{errors.firstSessionPriceUyu.message}</p>}
            </div>
          </fieldset>

          <Button type="submit" disabled={isSaving || isFetching}>
            {isSaving ? 'Guardando…' : 'Guardar precios'}
          </Button>

          {saved && <p className="text-sm text-success">Precios actualizados.</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </form>

        <form onSubmit={submitDiscountCode} className="max-w-xl space-y-4 rounded-lg border border-border bg-card p-7">
          <h2 className="text-xs uppercase tracking-wide text-muted-foreground">Código de descuento (sesión gratis)</h2>
          <div>
            <Label htmlFor="discount-code-value">Código</Label>
            <Input id="discount-code-value" value={codeValue} onChange={(e) => setCodeValue(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="discount-code-active" checked={codeActive} onCheckedChange={(checked) => setCodeActive(checked === true)} />
            <Label htmlFor="discount-code-active">Activo</Label>
          </div>
          <Button type="submit" disabled={isSavingCode || isFetchingCode}>
            {isSavingCode ? 'Guardando…' : 'Guardar código'}
          </Button>
          {codeSaved && <p className="text-sm text-success">Código actualizado.</p>}
          {codeError && <p className="text-sm text-destructive">{codeError}</p>}
        </form>
      </main>
    </div>
  );
};
