import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Ingresá tu email.').email('Email inválido.'),
  password: z.string().min(1, 'Ingresá tu clave.'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const testEmailSchema = z.string().trim().min(1, 'Poné un email válido.').email('Poné un email válido.');
