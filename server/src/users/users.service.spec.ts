import { UsersService } from './users.service';

describe('UsersService.upsertFromGoogleProfile', () => {
  const profile = { googleId: 'g-1', email: 'ana@example.com', name: 'Ana', avatarUrl: null };

  const makeService = (findOneImpl: jest.Mock) => {
    const repo = {
      findOne: findOneImpl,
      create: jest.fn((data) => data),
      save: jest.fn(async (data) => ({ id: 'u-1', phone: null, ...data })),
    };
    const jwt = { signAsync: jest.fn(async () => 'signed-token') };
    return { service: new UsersService(repo as never, {} as never, jwt as never), repo };
  };

  it('creates a new user when no match exists by googleId or email', async () => {
    const { service, repo } = makeService(jest.fn().mockResolvedValue(null));

    const user = await service.upsertFromGoogleProfile(profile);

    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ googleId: 'g-1', email: 'ana@example.com' }));
    expect(user.email).toBe('ana@example.com');
  });

  it('returns the existing user unchanged when found by googleId', async () => {
    const existing = { id: 'u-1', googleId: 'g-1', email: 'ana@example.com', phone: '099' };
    const { service, repo } = makeService(jest.fn().mockResolvedValue(existing));

    const user = await service.upsertFromGoogleProfile(profile);

    expect(user).toBe(existing);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('links googleId to an existing account matched by email instead of creating a duplicate', async () => {
    const existing = { id: 'u-1', googleId: null, email: 'ana@example.com', phone: '099' };
    const findOne = jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(existing);
    const { service, repo } = makeService(findOne);

    const user = await service.upsertFromGoogleProfile(profile);

    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ googleId: 'g-1' }));
    expect(user.email).toBe('ana@example.com');
  });
});

describe('UsersService.loginWithGoogle', () => {
  const profile = { googleId: 'g-1', email: 'ana@example.com', name: 'Ana', avatarUrl: null };

  it('reports profileComplete=false when the user has no phone yet', async () => {
    const repo = { findOne: jest.fn().mockResolvedValue(null), create: jest.fn((d) => d), save: jest.fn(async (d) => ({ id: 'u-1', phone: null, ...d })) };
    const jwt = { signAsync: jest.fn(async () => 'signed-token') };
    const service = new UsersService(repo as never, {} as never, jwt as never);

    const result = await service.loginWithGoogle(profile);

    expect(result).toEqual({ accessToken: 'signed-token', profileComplete: false });
  });

  it('reports profileComplete=true when the user already has a phone', async () => {
    const existing = { id: 'u-1', googleId: 'g-1', email: 'ana@example.com', phone: '099123456' };
    const repo = { findOne: jest.fn().mockResolvedValue(existing), create: jest.fn(), save: jest.fn() };
    const jwt = { signAsync: jest.fn(async () => 'signed-token') };
    const service = new UsersService(repo as never, {} as never, jwt as never);

    const result = await service.loginWithGoogle(profile);

    expect(result.profileComplete).toBe(true);
  });
});

describe('UsersService.tryRedeemFreeSession / restoreFreeSession', () => {
  const makeQueryBuilderRepo = (affected: number) => {
    const execute = jest.fn().mockResolvedValue({ affected });
    const qb = { update: jest.fn().mockReturnThis(), set: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), execute };
    const repo = { createQueryBuilder: jest.fn(() => qb) };
    return { service: new UsersService(repo as never, {} as never, {} as never), qb };
  };

  it('tryRedeemFreeSession returns true and flips the flag on first redemption', async () => {
    const { service, qb } = makeQueryBuilderRepo(1);
    await expect(service.tryRedeemFreeSession('u-1')).resolves.toBe(true);
    expect(qb.where).toHaveBeenCalledWith('id = :id AND free_session_redeemed_at IS NULL', { id: 'u-1' });
  });

  it('tryRedeemFreeSession returns false when the user already redeemed', async () => {
    const { service } = makeQueryBuilderRepo(0);
    await expect(service.tryRedeemFreeSession('u-1')).resolves.toBe(false);
  });

  it('restoreFreeSession clears the flag back to null', async () => {
    const { service, qb } = makeQueryBuilderRepo(1);
    await service.restoreFreeSession('u-1');
    expect(qb.set).toHaveBeenCalledWith({ freeSessionRedeemedAt: null });
    expect(qb.where).toHaveBeenCalledWith('id = :id', { id: 'u-1' });
  });
});
