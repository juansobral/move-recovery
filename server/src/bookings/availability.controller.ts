import { Controller, Get, Query } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { AvailabilityQueryDto } from './dto/availability-query.dto';
import { AvailabilityResponse } from './bookings.types';

@Controller('availability')
export class AvailabilityController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get()
  getAvailability(@Query() dto: AvailabilityQueryDto): Promise<AvailabilityResponse> {
    return this.bookingsService.getAvailability(dto);
  }
}
