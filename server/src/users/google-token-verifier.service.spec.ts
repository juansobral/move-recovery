import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { GoogleTokenVerifierService } from './google-token-verifier.service';

describe('GoogleTokenVerifierService', () => {
  const makeClient = (behavior: Record<string, unknown> | undefined | 'throw') => ({
    verifyIdToken: jest.fn().mockImplementation(async () => {
      if (behavior === 'throw') throw new Error('invalid token');
      return { getPayload: () => behavior };
    }),
  });

  const makeService = (client: ReturnType<typeof makeClient>) => {
    const config = { get: () => 'test-client-id' } as unknown as ConfigService;
    return new GoogleTokenVerifierService(client as never, config);
  };

  it('returns a normalized profile for a valid token', async () => {
    const client = makeClient({ sub: 'g-123', email: 'Ana@Example.com', name: 'Ana', picture: 'http://pic' });
    const profile = await makeService(client).verify('valid-token');

    expect(profile).toEqual({ googleId: 'g-123', email: 'ana@example.com', name: 'Ana', avatarUrl: 'http://pic' });
  });

  it('lowercases the email and defaults avatarUrl to null when there is no picture', async () => {
    const client = makeClient({ sub: 'g-1', email: 'Foo@Bar.com', name: 'Foo' });
    const profile = await makeService(client).verify('valid-token');

    expect(profile.email).toBe('foo@bar.com');
    expect(profile.avatarUrl).toBeNull();
  });

  it('throws UnauthorizedException when Google rejects the token', async () => {
    await expect(makeService(makeClient('throw')).verify('bad-token')).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when the payload is missing required fields', async () => {
    const client = makeClient({ sub: 'g-123' }); // no email
    await expect(makeService(client).verify('token')).rejects.toThrow(UnauthorizedException);
  });
});
