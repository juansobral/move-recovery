import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { SLOTS } from '../../catalog/catalog.constants';
import { IsBookingDate } from '../../bookings/validators/is-booking-date';

export class CreateCheckoutDto {
  @IsBookingDate()
  date: string;

  @IsIn(SLOTS, { message: 'Bloque horario no disponible.' })
  time: string;

  @IsOptional()
  @IsString()
  service?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64, { message: 'El código es demasiado largo.' })
  discountCode?: string;
}
