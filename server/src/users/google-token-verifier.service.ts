import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GOOGLE_OAUTH_CLIENT } from './google-oauth-client.provider';

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

// Subconjunto de OAuth2Client que realmente usamos — permite inyectar un
// fake en los tests sin depender de la clase concreta de google-auth-library.
export interface GoogleVerifiableClient {
  verifyIdToken(options: { idToken: string; audience: string }): Promise<{ getPayload(): Record<string, unknown> | undefined }>;
}

@Injectable()
export class GoogleTokenVerifierService {
  constructor(
    @Inject(GOOGLE_OAUTH_CLIENT) private readonly client: GoogleVerifiableClient,
    private readonly config: ConfigService,
  ) {}

  async verify(idToken: string): Promise<GoogleProfile> {
    const audience = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (!audience) throw new Error('Falta GOOGLE_CLIENT_ID.');

    let payload: Record<string, unknown> | undefined;
    try {
      const ticket = await this.client.verifyIdToken({ idToken, audience });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    if (!payload || !payload.sub || !payload.email) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    return {
      googleId: String(payload.sub),
      email: String(payload.email).toLowerCase(),
      name: String(payload.name ?? payload.email),
      avatarUrl: payload.picture ? String(payload.picture) : null,
    };
  }
}
