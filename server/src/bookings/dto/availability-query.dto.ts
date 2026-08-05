import { IsBookingDate } from '../validators/is-booking-date';

export class AvailabilityQueryDto {
  @IsBookingDate({ message: 'Fecha inválida. Formato AAAA-MM-DD.' })
  date: string;
}
