import { DiscountCodesService } from './discount-codes.service';

const makeService = (settings: { code: string; active: boolean } | null) => {
  const repo = { find: jest.fn().mockResolvedValue(settings ? [settings] : []), save: jest.fn(async (s) => s) };
  return { service: new DiscountCodesService(repo as never), repo };
};

describe('DiscountCodesService.isCodeValid', () => {
  it('returns false when the code is inactive', async () => {
    const { service } = makeService({ code: 'PROMO', active: false });
    await expect(service.isCodeValid('PROMO')).resolves.toBe(false);
  });

  it('returns false when the submitted code does not match', async () => {
    const { service } = makeService({ code: 'PROMO', active: true });
    await expect(service.isCodeValid('OTRO')).resolves.toBe(false);
  });

  it('matches case-insensitively and ignores surrounding whitespace', async () => {
    const { service } = makeService({ code: 'PROMO', active: true });
    await expect(service.isCodeValid('  promo  ')).resolves.toBe(true);
  });

  it('throws when no settings row exists', async () => {
    const { service } = makeService(null);
    await expect(service.isCodeValid('PROMO')).rejects.toThrow('No hay código de descuento configurado.');
  });

  it('returns false when the active code is empty/whitespace even though active=true', async () => {
    const { service } = makeService({ code: '   ', active: true });
    await expect(service.isCodeValid(' ')).resolves.toBe(false);
    await expect(service.isCodeValid('')).resolves.toBe(false);
    await expect(service.isCodeValid('anything')).resolves.toBe(false);
  });
});
