// Única fuente de verdad de horarios y servicios — usada tanto para validar
// reservas (bookings) como para lo que expone este módulo al front.
export const SLOTS = ['07:00', '08:00', '09:00', '10:00', '15:00', '16:00', '17:00', '18:00', '19:00'] as const;

export type Slot = (typeof SLOTS)[number];

export const SERVICIOS = [
  'Recovery Room',
  'Presoterapia',
  'Luz roja e infrarroja',
  'Sauna infrarrojo',
  'Sillón gravedad cero',
  'Meditación y respiración',
] as const;

export type Servicio = (typeof SERVICIOS)[number];

// Los precios (priceUyu/priceSocioUyu) ya no viven acá — son configurables
// desde el admin, ver server/src/pricing/ (tabla pricing_settings).
export const PLANS = {
  standard: { label: 'Standard Reset', sessionsPerMonth: 4 },
  premium: { label: 'Premium Reset', sessionsPerMonth: 8 },
} as const;

export type PlanKey = keyof typeof PLANS;
