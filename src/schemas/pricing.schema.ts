import { z } from 'zod';

const price = z.coerce.number({ invalid_type_error: 'El precio debe ser un número.' }).int('El precio debe ser un número entero.').positive('El precio debe ser mayor a 0.');

export const pricingSchema = z.object({
  standardPriceUyu: price,
  standardPriceSocioUyu: price,
  premiumPriceUyu: price,
  premiumPriceSocioUyu: price,
  resetSessionPriceUyu: price,
  resetSessionPriceSocioUyu: price,
  firstSessionPriceUyu: price,
});

export type PricingFormValues = z.infer<typeof pricingSchema>;
