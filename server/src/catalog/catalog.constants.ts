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

export const PLANS = {
  standard: { label: 'Standard Reset', priceUyu: 2400, priceSocioUyu: 1200, sessionsPerMonth: 4 },
  premium: { label: 'Premium Reset', priceUyu: 3840, priceSocioUyu: 1920, sessionsPerMonth: 8 },
} as const;

export type PlanKey = keyof typeof PLANS;

export const RESET_SESSION_PRICE = { priceUyu: 600, priceSocioUyu: 300 } as const;
