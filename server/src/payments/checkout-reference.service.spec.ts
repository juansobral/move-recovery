import { CheckoutReferenceService, OneOffBookingIntent } from './checkout-reference.service';

describe('CheckoutReferenceService', () => {
  const sampleIntent: OneOffBookingIntent = {
    kind: 'oneoff',
    userId: 'u-1',
    date: '2026-09-01',
    time: '08:00',
    service: 'Recovery Room',
  };

  const makeService = () => {
    const rows = new Map<string, { id: string; userId: string; payload: unknown }>();
    let counter = 0;
    const repo = {
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn(async (row) => {
        const id = `intent-${++counter}`;
        const saved = { id, userId: row.userId, payload: row.payload };
        rows.set(id, saved);
        return saved;
      }),
      findOne: jest.fn(async ({ where: { id } }) => rows.get(id) ?? null),
    };
    return { service: new CheckoutReferenceService(repo as never), repo };
  };

  it('round-trips a signed intent via a short opaque reference', async () => {
    const { service } = makeService();
    const reference = await service.sign(sampleIntent);
    expect(reference.length).toBeLessThanOrEqual(64);
    expect(await service.verify(reference)).toEqual(sampleIntent);
  });

  it('rejects an unknown reference', async () => {
    const { service } = makeService();
    expect(await service.verify('does-not-exist')).toBeNull();
  });

  it('rejects an empty reference', async () => {
    const { service } = makeService();
    expect(await service.verify('')).toBeNull();
  });
});
