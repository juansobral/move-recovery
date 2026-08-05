import { SubscriptionsService } from './subscriptions.service';

const TODAY = '2026-08-05';

describe('SubscriptionsService.findCurrent / tryConsumeCredit', () => {
  const makeService = (findOneImpl: jest.Mock, saveImpl?: jest.Mock) => {
    const repo = {
      findOne: findOneImpl,
      save: saveImpl ?? jest.fn(async (s) => s),
      create: jest.fn((data) => data),
    };
    return { service: new SubscriptionsService(repo as never), repo };
  };

  it('tryConsumeCredit returns false when there is no current subscription', async () => {
    const { service } = makeService(jest.fn().mockResolvedValue(null));
    await expect(service.tryConsumeCredit('u-1')).resolves.toBe(false);
  });

  it('tryConsumeCredit returns false when credits are exhausted', async () => {
    const sub = { id: 's-1', userId: 'u-1', sessionCreditsRemaining: 0, currentPeriodEnd: '2026-08-31' };
    const { service, repo } = makeService(jest.fn().mockResolvedValue(sub));
    await expect(service.tryConsumeCredit('u-1')).resolves.toBe(false);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('tryConsumeCredit decrements and returns true when a credit is available', async () => {
    const sub = { id: 's-1', userId: 'u-1', sessionCreditsRemaining: 3, currentPeriodEnd: '2026-08-31' };
    const { service, repo } = makeService(jest.fn().mockResolvedValue(sub));
    await expect(service.tryConsumeCredit('u-1')).resolves.toBe(true);
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ sessionCreditsRemaining: 2 }));
  });
});

describe('SubscriptionsService.createFromPreapproval', () => {
  it('creates a subscription with a full credit allotment for the chosen plan', async () => {
    const repo = { findOne: jest.fn(), save: jest.fn(async (s) => s), create: jest.fn((data) => data) };
    const service = new SubscriptionsService(repo as never);

    const sub = await service.createFromPreapproval({
      userId: 'u-1',
      plan: 'premium',
      mpPreapprovalId: 'mp-123',
      periodStart: TODAY,
      periodEnd: '2026-09-04',
    });

    expect(sub).toEqual(
      expect.objectContaining({
        userId: 'u-1',
        plan: 'premium',
        mpPreapprovalId: 'mp-123',
        status: 'authorized',
        sessionCreditsTotal: 8,
        sessionCreditsRemaining: 8,
        currentPeriodStart: TODAY,
        currentPeriodEnd: '2026-09-04',
      }),
    );
  });
});
