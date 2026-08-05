import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, UseGuards } from '@nestjs/common';
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
    return { id: user!.id, email: user!.email, name: user!.name, phone: user!.phone, avatarUrl: user!.avatarUrl };
  }

  @Patch('me')
  @UseGuards(UserJwtAuthGuard)
  async completeProfile(@CurrentUser() customer: AuthenticatedCustomer, @Body() dto: CompleteProfileDto) {
    const user = await this.usersService.completePhone(customer.id, dto.phone);
    return { id: user.id, email: user.email, name: user.name, phone: user.phone, avatarUrl: user.avatarUrl };
  }
}
