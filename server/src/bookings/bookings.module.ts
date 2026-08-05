import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { AvailabilityController } from './availability.controller';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { Booking } from './entities/booking.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Booking]), MailModule, AuthModule],
  controllers: [BookingsController, AvailabilityController],
  providers: [BookingsService],
})
export class BookingsModule {}
