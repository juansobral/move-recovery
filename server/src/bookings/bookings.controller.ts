import { BadRequestException, Body, Controller, Delete, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserJwtAuthGuard } from '../users/guards/user-jwt-auth.guard';
import { CurrentUser } from '../users/decorators/current-user.decorator';
import { AuthenticatedCustomer } from '../users/users.types';
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
  @UseGuards(UserJwtAuthGuard)
  create(@Body() dto: CreateBookingDto, @CurrentUser() customer: AuthenticatedCustomer): Promise<CreateBookingResponse> {
    return this.bookingsService.create(dto, customer.id);
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
