import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { AdminTopNav } from '../../components/admin/AdminTopNav';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useGetAdminPricingQuery, useUpdatePricingMutation } from '../../features/api/pricingApi';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { extractApiErrorMessage } from '../../lib/apiError';
import { pricingSchema, type PricingFormValues } from '../../schemas/pricing.schema';

export const AdminPricingPage = (): JSX.Element => {
  useDocumentTitle('Precios · Admin · MOVE®');
  const { data: pricing, isFetching, refetch } = useGetAdminPricingQuery();
  const [updatePricing, { isLoading: isSaving }] = useUpdatePricingMutation();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
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

  return (
    <div>
      <AdminTopNav onReload={refetch} isReloading={isFetching} />
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
                <Label htmlFor="standardPriceSocioUyu">Precio socio</Label>
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
                <Label htmlFor="premiumPriceSocioUyu">Precio socio</Label>
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
                <Label htmlFor="resetSessionPriceSocioUyu">Precio socio</Label>
                <Input id="resetSessionPriceSocioUyu" type="number" {...register('resetSessionPriceSocioUyu')} />
                {errors.resetSessionPriceSocioUyu && (
                  <p className="mt-1 text-xs text-destructive">{errors.resetSessionPriceSocioUyu.message}</p>
                )}
              </div>
            </div>
          </fieldset>

          <Button type="submit" disabled={isSaving || isFetching}>
            {isSaving ? 'Guardando…' : 'Guardar precios'}
          </Button>

          {saved && <p className="text-sm text-success">Precios actualizados.</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </form>
      </main>
    </div>
  );
};
