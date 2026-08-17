import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { Booking } from '../bookings/entities/booking.entity';
import { CurrentUser } from './decorators/current-user.decorator';
import { CompleteProfileDto } from './dto/complete-profile.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { UserJwtAuthGuard } from './guards/user-jwt-auth.guard';
import { GoogleTokenVerifierService } from './google-token-verifier.service';
import { AuthenticatedCustomer } from './users.types';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly googleVerifier: GoogleTokenVerifierService,
    @InjectRepository(Booking) private readonly bookingsRepo: Repository<Booking>,
  ) {}

  @Post('auth/google')
  @HttpCode(HttpStatus.OK)
  async loginWithGoogle(@Body() dto: GoogleLoginDto) {
    const profile = await this.googleVerifier.verify(dto.idToken);
    return this.usersService.loginWithGoogle(profile);
  }

  @Get('me')
  @UseGuards(UserJwtAuthGuard)
  async me(@CurrentUser() customer: AuthenticatedCustomer) {
    const user = await this.usersService.findById(customer.id);
    const hasPaidOneOffBooking = await this.hasPaidOneOffBooking(customer.id);
    return {
      id: user!.id,
      email: user!.email,
      name: user!.name,
      phone: user!.phone,
      avatarUrl: user!.avatarUrl,
      isSocio: user!.isSocio,
      hasPaidOneOffBooking,
    };
  }

  @Patch('me')
  @UseGuards(UserJwtAuthGuard)
  async completeProfile(@CurrentUser() customer: AuthenticatedCustomer, @Body() dto: CompleteProfileDto) {
    const user = await this.usersService.completePhone(customer.id, dto.phone);
    const hasPaidOneOffBooking = await this.hasPaidOneOffBooking(customer.id);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      isSocio: user.isSocio,
      hasPaidOneOffBooking,
    };
  }

  private async hasPaidOneOffBooking(userId: string): Promise<boolean> {
    const count = await this.bookingsRepo.count({ where: { userId, mpPaymentId: Not(IsNull()) } });
    return count > 0;
  }

  @Get('me/bookings')
  @UseGuards(UserJwtAuthGuard)
  getMyBookings(@CurrentUser() customer: AuthenticatedCustomer) {
    return this.bookingsRepo.find({ where: { userId: customer.id }, order: { date: 'DESC', time: 'DESC' } });
  }
}
