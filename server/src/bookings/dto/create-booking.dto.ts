import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { SLOTS } from '../../catalog/catalog.constants';
import { IsBookingDate } from '../validators/is-booking-date';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateBookingDto {
  @IsBookingDate()
  date: string;

  @IsIn(SLOTS, { message: 'Bloque horario no disponible.' })
  time: string;

  // Sin @IsIn: si no está en SERVICIOS, BookingsService lo normaliza a
  // 'Recovery Room' en vez de rechazar la reserva — comportamiento original.
  @IsOptional()
  @IsString()
  service?: string;

  @Transform(trim)
  @IsString({ message: 'Ingresá tu nombre.' })
  @MinLength(2, { message: 'Ingresá tu nombre.' })
  name: string;

  @Transform(trim)
  @IsEmail({}, { message: 'Email inválido.' })
  email: string;

  @Transform(trim)
  @IsString({ message: 'Ingresá un teléfono válido.' })
  @MinLength(6, { message: 'Ingresá un teléfono válido.' })
  phone: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  notes?: string;
}
