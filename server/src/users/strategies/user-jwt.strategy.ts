import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedCustomer, UserJwtPayload } from '../users.types';

@Injectable()
export class UserJwtStrategy extends PassportStrategy(Strategy, 'user-jwt') {
  constructor(config: ConfigService) {
    const secret = config.get<string>('USER_JWT_SECRET');
    if (!secret) throw new Error('Falta USER_JWT_SECRET.');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: UserJwtPayload): AuthenticatedCustomer {
    if (!payload?.sub || !payload?.email) throw new UnauthorizedException('No autorizado.');
    return { id: payload.sub, email: payload.email };
  }
}
