import { IsOptional, IsString } from 'class-validator';
import { IsIn } from 'class-validator';
import { SLOTS } from '../../catalog/catalog.constants';
import { IsBookingDate } from '../validators/is-booking-date';

export class CreateBookingDto {
  @IsBookingDate()
  date: string;

  @IsIn(SLOTS, { message: 'Bloque horario no disponible.' })
  time: string;

  // Sin @IsIn: si no está en SERVICIOS, BookingsService lo normaliza a
  // 'Recovery Room' en vez de rechazar la reserva — comportamiento heredado.
  @IsOptional()
  @IsString()
  service?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
