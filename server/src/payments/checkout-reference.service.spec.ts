import { ConfigService } from '@nestjs/config';
import { CheckoutReferenceService, OneOffBookingIntent } from './checkout-reference.service';

describe('CheckoutReferenceService', () => {
  const makeService = () => {
    const config = { get: () => 'test-secret' } as unknown as ConfigService;
    return new CheckoutReferenceService(config);
  };

  const sampleIntent: OneOffBookingIntent = {
    kind: 'oneoff',
    userId: 'u-1',
    date: '2026-09-01',
    time: '08:00',
    service: 'Recovery Room',
  };

  it('round-trips a signed intent', () => {
    const service = makeService();
    const reference = service.sign(sampleIntent);
    expect(service.verify(reference)).toEqual(sampleIntent);
  });

  it('rejects a reference with a tampered payload', () => {
    const service = makeService();
    const reference = service.sign(sampleIntent);
    const [payload, signature] = reference.split('.');
    const tamperedPayload = Buffer.from(JSON.stringify({ ...sampleIntent, date: '2026-09-02' })).toString('base64url');
    expect(service.verify(`${tamperedPayload}.${signature}`)).toBeNull();
  });

  it('rejects a reference with a tampered signature', () => {
    const service = makeService();
    const reference = service.sign(sampleIntent);
    const [payload] = reference.split('.');
    expect(service.verify(`${payload}.0000000000000000000000000000000000000000000000000000000000000000`)).toBeNull();
  });

  it('rejects a malformed reference', () => {
    const service = makeService();
    expect(service.verify('not-a-valid-reference')).toBeNull();
  });
});
