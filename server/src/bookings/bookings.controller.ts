import { BadRequestException, Controller, Delete, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BookingsService } from './bookings.service';
import { Booking } from './entities/booking.entity';
import { CancelBookingResponse } from './bookings.types';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  list(): Promise<Booking[]> {
    return this.bookingsService.findAllOrdered();
  }

  @Delete()
  @UseGuards(JwtAuthGuard)
  cancel(@Query('id') idRaw: string, @Query('notify') notifyRaw?: string): Promise<CancelBookingResponse> {
    const id = Number(idRaw);
    if (!Number.isInteger(id) || id <= 0) throw new BadRequestException('ID inválido.');
    const notify = notifyRaw !== '0';
    return this.bookingsService.cancel(id, notify);
  }
}
