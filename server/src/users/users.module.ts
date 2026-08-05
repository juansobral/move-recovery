import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Booking } from '../bookings/entities/booking.entity';
import { User } from './entities/user.entity';
import { AdminUsersController } from './admin-users.controller';
import { googleOAuthClientProvider } from './google-oauth-client.provider';
import { GoogleTokenVerifierService } from './google-token-verifier.service';
import { UserJwtStrategy } from './strategies/user-jwt.strategy';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Booking]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('USER_JWT_SECRET'),
        signOptions: { expiresIn: '30d' },
      }),
    }),
    AuthModule,
  ],
  controllers: [UsersController, AdminUsersController],
  providers: [UsersService, GoogleTokenVerifierService, googleOAuthClientProvider, UserJwtStrategy],
  exports: [JwtModule, PassportModule, UsersService],
})
export class UsersModule {}
