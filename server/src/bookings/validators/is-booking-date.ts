import { registerDecorator, ValidationOptions } from 'class-validator';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Igual que isValidDate() en el lib/db.js original: formato AAAA-MM-DD y que
// sea una fecha de calendario real (rechaza p. ej. 2026-02-30).
function isBookingDate(value: unknown): boolean {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function IsBookingDate(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isBookingDate',
      target: object.constructor,
      propertyName,
      options: { message: 'Fecha inválida.', ...validationOptions },
      validator: {
        validate: isBookingDate,
      },
    });
  };
}
