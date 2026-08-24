import { BadRequestException, ConflictException } from '@nestjs/common';
import { PaymentsController } from './payments.controller';

describe('PaymentsController.checkoutBooking — discount code redemption', () => {
  const customer = { id: 'u-1', email: 'ana@example.com' } as never;
  const dto = { date: '2026-09-01', time: '09:00', service: 'Recovery Room', discountCode: 'PROMO' } as never;

  const makeController = (overrides: {
    isCodeValid?: boolean;
    redeemed?: boolean;
    create?: jest.Mock;
  }) => {
    const bookingsService = {
      create: overrides.create ?? jest.fn().mockResolvedValue({ id: 1, date: '2026-09-01', time: '09:00', emailSent: true }),
    };
    const subscriptionsService = { tryConsumeCredit: jest.fn().mockResolvedValue(false) };
    const usersService = {
      findById: jest.fn(),
      tryRedeemFreeSession: jest.fn().mockResolvedValue(overrides.redeemed ?? true),
      restoreFreeSession: jest.fn().mockResolvedValue(undefined),
    };
    const pricingService = { getResetSessionPrice: jest.fn() };
    const discountCodesService = { isCodeValid: jest.fn().mockResolvedValue(overrides.isCodeValid ?? true) };
    const checkoutReference = { sign: jest.fn() };
    const mercadoPago = { createPreference: jest.fn() };
    const config = { get: jest.fn() };

    const controller = new PaymentsController(
      bookingsService as never,
      subscriptionsService as never,
      usersService as never,
      pricingService as never,
      discountCodesService as never,
      checkoutReference as never,
      mercadoPago as never,
      config as never,
    );
    return { controller, bookingsService, usersService, discountCodesService };
  };

  it('rejects an invalid or inactive code without touching redemption state', async () => {
    const { controller, usersService } = makeController({ isCodeValid: false });
    await expect(controller.checkoutBooking(dto, customer)).rejects.toBeInstanceOf(BadRequestException);
    expect(usersService.tryRedeemFreeSession).not.toHaveBeenCalled();
  });

  it('creates the booking directly (no MercadoPago) on first redemption', async () => {
    const { controller, bookingsService, discountCodesService } = makeController({});
    const result = await controller.checkoutBooking(dto, customer);
    expect(discountCodesService.isCodeValid).toHaveBeenCalledWith('PROMO');
    expect(bookingsService.create).toHaveBeenCalledWith(dto, 'u-1');
    expect(result).toEqual(expect.objectContaining({ id: 1 }));
  });

  it('rejects a user who already redeemed their free session', async () => {
    const { controller } = makeController({ redeemed: false });
    await expect(controller.checkoutBooking(dto, customer)).rejects.toBeInstanceOf(ConflictException);
  });

  it('restores the free session if booking creation fails after redemption', async () => {
    const failingCreate = jest.fn().mockRejectedValue(new Error('bloque tomado'));
    const { controller, usersService } = makeController({ create: failingCreate });
    await expect(controller.checkoutBooking(dto, customer)).rejects.toThrow('bloque tomado');
    expect(usersService.restoreFreeSession).toHaveBeenCalledWith('u-1');
  });
});
