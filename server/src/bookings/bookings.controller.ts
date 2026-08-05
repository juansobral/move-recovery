import { BadRequestException, Body, Controller, Delete, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AvailabilityQueryDto } from './dto/availability-query.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { BookingsService } from './bookings.service';
import { Booking } from './entities/booking.entity';
import { CancelBookingResponse, CreateBookingResponse } from './bookings.types';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  list(): Promise<Booking[]> {
    return this.bookingsService.findAllOrdered();
  }

  @Post()
  create(@Body() dto: CreateBookingDto): Promise<CreateBookingResponse> {
    return this.bookingsService.create(dto);
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
