import { z } from 'zod';

// Mirror del lado del cliente de las reglas de server/src/bookings/dto — no
// comparten código (repos/runtimes distintos), pero deben devolver los mismos
// mensajes en español para que el usuario vea el mismo texto de un lado y del otro.
export const clientFieldsSchema = z.object({
  name: z.string().trim().min(2, 'Ingresá tu nombre.'),
  email: z.string().trim().min(1, 'Email inválido.').email('Email inválido.'),
  phone: z.string().trim().min(6, 'Ingresá un teléfono válido.'),
  notes: z.string().optional(),
});

export type ClientFieldsValues = z.infer<typeof clientFieldsSchema>;
