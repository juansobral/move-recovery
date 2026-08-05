import { SubscriptionsService } from './subscriptions.service';

const TODAY = '2026-08-05';

describe('SubscriptionsService.findCurrent / tryConsumeCredit', () => {
  // El consumo de crédito es un UPDATE condicional atómico, así que el mock
  // tiene que ser la cadena del query builder, no findOne/save.
  const makeQueryBuilderRepo = (findOneImpl: jest.Mock, affected: number) => {
    const execute = jest.fn().mockResolvedValue({ affected });
    const qb = { update: jest.fn().mockReturnThis(), set: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), execute };
    const repo = { findOne: findOneImpl, createQueryBuilder: jest.fn(() => qb) };
    return { service: new SubscriptionsService(repo as never), repo, qb };
  };

  it('tryConsumeCredit returns false when there is no current subscription', async () => {
    const { service, repo } = makeQueryBuilderRepo(jest.fn().mockResolvedValue(null), 1);
    await expect(service.tryConsumeCredit('u-1')).resolves.toBe(false);
    expect(repo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('tryConsumeCredit returns false when the conditional update matches no row (credits exhausted)', async () => {
    const sub = { id: 's-1', userId: 'u-1', sessionCreditsRemaining: 0, currentPeriodEnd: '2026-08-31' };
    const { service, qb } = makeQueryBuilderRepo(jest.fn().mockResolvedValue(sub), 0);
    await expect(service.tryConsumeCredit('u-1')).resolves.toBe(false);
    expect(qb.where).toHaveBeenCalledWith('id = :id AND session_credits_remaining > 0', { id: 's-1' });
  });

  it('tryConsumeCredit returns true when the conditional update decrements a row', async () => {
    const sub = { id: 's-1', userId: 'u-1', sessionCreditsRemaining: 3, currentPeriodEnd: '2026-08-31' };
    const { service, qb } = makeQueryBuilderRepo(jest.fn().mockResolvedValue(sub), 1);
    await expect(service.tryConsumeCredit('u-1')).resolves.toBe(true);
    expect(qb.execute).toHaveBeenCalled();
  });
});

describe('SubscriptionsService.restoreCredit', () => {
  const makeQueryBuilderRepo = (findOneImpl: jest.Mock) => {
    const execute = jest.fn().mockResolvedValue({ affected: 1 });
    const qb = { update: jest.fn().mockReturnThis(), set: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), execute };
    const repo = { findOne: findOneImpl, createQueryBuilder: jest.fn(() => qb) };
    return { service: new SubscriptionsService(repo as never), repo, qb };
  };

  it('runs the update chain for the current subscription', async () => {
    const sub = { id: 's-1', userId: 'u-1', sessionCreditsRemaining: 2, currentPeriodEnd: '2026-08-31' };
    const { service, qb } = makeQueryBuilderRepo(jest.fn().mockResolvedValue(sub));
    await expect(service.restoreCredit('u-1')).resolves.toBeUndefined();
    expect(qb.where).toHaveBeenCalledWith('id = :id', { id: 's-1' });
    expect(qb.execute).toHaveBeenCalled();
  });

  it('does nothing (and does not throw) when there is no current subscription', async () => {
    const { service, repo } = makeQueryBuilderRepo(jest.fn().mockResolvedValue(null));
    await expect(service.restoreCredit('u-1')).resolves.toBeUndefined();
    expect(repo.createQueryBuilder).not.toHaveBeenCalled();
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
