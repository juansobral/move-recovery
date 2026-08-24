import { z } from 'zod';

export const SLOTS = ['09:00', '10:00', '11:00', '18:00', '19:00', '20:00'] as const;
export const SERVICIOS = [
  'Recovery Room', 'Presoterapia', 'Luz roja e infrarroja',
  'Sauna infrarrojo', 'Sillón gravedad cero', 'Meditación y respiración',
] as const;

export const clientFieldsSchema = z.object({
  notes: z.string().optional(),
});

export type ClientFieldsValues = z.infer<typeof clientFieldsSchema>;
