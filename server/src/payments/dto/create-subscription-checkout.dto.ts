import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';
import { SLOTS } from '../../catalog/catalog.constants';
import { IsBookingDate } from '../../bookings/validators/is-booking-date';

class IntendedBookingDto {
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
}

export class CreateSubscriptionCheckoutDto {
  @IsIn(['standard', 'premium'], { message: 'Plan inválido.' })
  plan: 'standard' | 'premium';

  @IsOptional()
  @ValidateNested()
  @Type(() => IntendedBookingDto)
  intendedBooking?: IntendedBookingDto;
}
