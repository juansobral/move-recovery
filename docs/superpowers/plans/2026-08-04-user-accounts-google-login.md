# User accounts + Google login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let customers create an account via Google, log in, complete a one-time profile (phone), and book sessions while logged in — replacing today's anonymous public booking form.

**Architecture:** Frontend uses Google Identity Services (client-side button) to get a signed Google ID token with no page redirect. The NestJS backend verifies that token against Google's public keys, upserts a `User` row, and issues our own JWT — signed with a secret and guard completely separate from the existing admin JWT, so the two auth realms can never cross. `Booking` gains a `userId` FK; booking creation becomes guarded by the new customer JWT instead of being public.

**Tech Stack:** NestJS + TypeORM (existing), `google-auth-library` (new), Jest + `@nestjs/testing` (new, backend only), React + Redux Toolkit + RTK Query (existing), Google Identity Services JS SDK (new, loaded via `<script>` tag, no npm package).

## Global Constraints

- Login is required to book, going forward — no anonymous booking path remains.
- Customer accounts (`users` table) and admin accounts (`admin_users` table) are completely separate: separate entities, separate JWT secrets (`USER_JWT_SECRET` vs the existing `JWT_SECRET`), separate guards/strategies, separate frontend Redux slices and axios instances. Zero shared code between the two auth realms.
- Google is the only login method for customers. No password storage, no reset-password flow, for customers.
- The booking form no longer collects name/email/phone — those come from the authenticated user's profile (name/email from Google, phone collected once via a profile-completion step).
- `Booking.name`/`Booking.email`/`Booking.phone` stay on the entity as a point-in-time snapshot (populated server-side from the user's current profile at booking time) — this preserves the existing "snapshot, not live join" pattern already used for `Booking.service`.
- No self-service booking cancellation by customers in this phase (only viewing). Subscription cancellation and plan data are out of scope for this plan entirely — they belong to a later sub-project.
- Automated unit tests (Jest) are added for the two pieces of genuinely branching new logic: Google ID token verification and the user upsert-by-googleId-or-email logic. Everything else (controllers, guards, migrations, frontend) is verified manually via curl and a real browser pass, consistent with how the rest of this project has been built and verified this session — this repo has no pre-existing test runner, and adding a full frontend test harness for this feature would be disproportionate to its scope.
- All error responses keep the existing `{ error: '<mensaje en español>' }` shape (the global `HttpExceptionFilter` already handles this for any thrown `HttpException`, nothing new to build there).

---

## File Structure

**Backend (`server/`), all new unless marked Modify:**

```
server/src/users/
  entities/user.entity.ts
  users.types.ts
  dto/complete-profile.dto.ts
  dto/google-login.dto.ts
  google-oauth-client.provider.ts
  google-token-verifier.service.ts
  google-token-verifier.service.spec.ts   (test)
  users.service.ts
  users.service.spec.ts                    (test)
  strategies/user-jwt.strategy.ts
  guards/user-jwt-auth.guard.ts
  decorators/current-user.decorator.ts
  users.controller.ts
  users.module.ts
server/src/migrations/
  <ts>-CreateUsers.ts
  <ts>-AddUserIdToBookings.ts
server/src/bookings/entities/booking.entity.ts   (Modify: add userId column + relation)
server/src/bookings/dto/create-booking.dto.ts    (Modify: remove name/email/phone)
server/src/bookings/bookings.service.ts          (Modify: create() takes userId, snapshots from User)
server/src/bookings/bookings.controller.ts       (Modify: guard POST with UserJwtAuthGuard)
server/src/bookings/bookings.module.ts           (Modify: import UsersModule, add User to TypeOrmModule.forFeature)
server/src/app.module.ts                         (Modify: register User entity + UsersModule)
server/package.json                              (Modify: new deps + test script)
server/jest.config.js                            (new)
```

**Frontend (root `src/`), all new unless marked Modify:**

```
src/types/user.types.ts
src/features/userAuth/userAuthSlice.ts
src/lib/userAxios.ts
src/lib/userAxiosBaseQuery.ts
src/features/api/userApi.ts
src/features/api/bookingsApi.ts                  (Modify: remove createBooking, it moves to userApi)
src/hooks/useBookingFlow.ts                      (Modify: import useCreateBookingMutation from userApi)
src/schemas/booking.schema.ts                    (Modify: clientFieldsSchema drops name/email/phone)
src/components/booking/BookingForm/index.tsx     (Modify: drop name/email/phone fields)
src/components/booking/BookingSection/index.tsx  (Modify: gate on login)
src/components/auth/GoogleSignInButton/index.tsx
src/hooks/useGoogleAuth.ts
src/routes/RequireUserAuth/index.tsx
src/pages/CompleteProfilePage/index.tsx
src/pages/MiCuentaPage/index.tsx
src/routes/router.tsx                            (Modify: add /completar-perfil, /mi-cuenta)
index.html                                       (Modify: add Google Identity Services script tag)
.env.example                                     (Modify: add GOOGLE_CLIENT_ID, USER_JWT_SECRET, VITE_GOOGLE_CLIENT_ID)
```

**Module dependency direction (no cycles):** `BookingsModule` imports `UsersModule` (to use `UserJwtAuthGuard`) and also imports `TypeOrmModule.forFeature([User])` directly (read-only lookup of the booking user's current name/email/phone at booking time). `UsersModule` imports its own `TypeOrmModule.forFeature([Booking])` directly for `GET /users/me/bookings`, and never imports `BookingsModule`. This keeps the dependency one-directional.

---

## Task 1: Backend test tooling + new dependencies

**Files:**
- Modify: `server/package.json`
- Create: `server/jest.config.js`

**Interfaces:**
- Produces: `npm test --workspace=server` command, usable by every later backend task with a `.spec.ts` file.

- [ ] **Step 1: Add dependencies**

Run from the repo root:
```bash
npm install google-auth-library --workspace=server
npm install -D jest @types/jest ts-jest @nestjs/testing --workspace=server
```

- [ ] **Step 2: Create the Jest config**

```js
// server/jest.config.js
module.exports = {
  rootDir: 'src',
  testEnvironment: 'node',
  transform: { '^.+\\.ts$': ['ts-jest', { isolatedModules: true }] },
  testRegex: '.*\\.spec\\.ts$',
};
```

- [ ] **Step 3: Add the test script**

In `server/package.json`, inside `"scripts"`, add:
```json
"test": "jest --config jest.config.js"
```

- [ ] **Step 4: Verify Jest runs (with zero tests yet)**

Run: `npm test --workspace=server`
Expected: `No tests found` message, exit code non-zero is fine at this point — this step only confirms Jest itself is wired up and not erroring on config. If it prints a config/module error instead of "no tests found", fix the config before continuing.

- [ ] **Step 5: Commit**

```bash
git add server/package.json server/package-lock.json server/jest.config.js
git commit -m "chore(server): add Jest and google-auth-library"
```

---

## Task 2: User entity + migration

**Files:**
- Create: `server/src/users/entities/user.entity.ts`
- Create: `server/src/migrations/1785894479938-CreateUsers.ts`

**Interfaces:**
- Produces: `User` class with fields `id: string`, `googleId: string`, `email: string`, `name: string`, `phone: string | null`, `avatarUrl: string | null`, `isSocio: boolean`, `createdAt: Date`. Used by every later backend task in this plan.

- [ ] **Step 1: Write the entity**

```ts
// server/src/users/entities/user.entity.ts
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', unique: true })
  googleId: string;

  @Column({ type: 'text', unique: true })
  email: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', nullable: true })
  phone: string | null;

  @Column({ name: 'avatar_url', type: 'text', nullable: true })
  avatarUrl: string | null;

  // Bandera manual que setea un admin — no hay UI para esto todavía (llega
  // en una fase posterior), pero el campo existe ya para no re-migrar luego.
  @Column({ name: 'is_socio', default: false })
  isSocio: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
```

- [ ] **Step 2: Write the migration**

```ts
// server/src/migrations/1785894479938-CreateUsers.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsers1785894479938 implements MigrationInterface {
  name = 'CreateUsers1785894479938';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "googleId" text NOT NULL,
        "email" text NOT NULL,
        "name" text NOT NULL,
        "phone" text,
        "avatar_url" text,
        "is_socio" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_googleId" UNIQUE ("googleId"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
```

- [ ] **Step 3: Register the entity in the app**

In `server/src/app.module.ts`, add the import and include it in the `entities` array passed to `TypeOrmModule.forRootAsync`:
```ts
import { User } from './users/entities/user.entity';
// ...
entities: [AdminUser, Booking, User],
```

Also add it to `server/src/data-source.ts`'s `entities` array the same way, so `migration:generate` keeps working correctly against the full schema.

- [ ] **Step 4: Run the migration against your local test database**

Run: `npm run migration:run --workspace=server`
Expected: Output shows `Migration CreateUsers1785894479938 has been executed successfully.`

- [ ] **Step 5: Commit**

```bash
git add server/src/users/entities/user.entity.ts server/src/migrations/1785894479938-CreateUsers.ts server/src/app.module.ts server/src/data-source.ts
git commit -m "feat(server): add User entity and migration"
```

---

## Task 3: Google ID token verification (TDD)

**Files:**
- Create: `server/src/users/google-oauth-client.provider.ts`
- Create: `server/src/users/google-token-verifier.service.ts`
- Test: `server/src/users/google-token-verifier.service.spec.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `GoogleProfile` interface (`{ googleId: string, email: string, name: string, avatarUrl: string | null }`) and `GoogleTokenVerifierService.verify(idToken: string): Promise<GoogleProfile>` (throws `UnauthorizedException` on any invalid/unverifiable token). Task 4 and Task 6 both use this.

- [ ] **Step 1: Write the failing test**

```ts
// server/src/users/google-token-verifier.service.spec.ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace=server -- google-token-verifier`
Expected: FAIL — `Cannot find module './google-token-verifier.service'`

- [ ] **Step 3: Write the provider**

```ts
// server/src/users/google-oauth-client.provider.ts
import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

export const GOOGLE_OAUTH_CLIENT = 'GOOGLE_OAUTH_CLIENT';

export const googleOAuthClientProvider: Provider = {
  provide: GOOGLE_OAUTH_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => new OAuth2Client(config.get<string>('GOOGLE_CLIENT_ID')),
};
```

- [ ] **Step 4: Write the minimal implementation**

```ts
// server/src/users/google-token-verifier.service.ts
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
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test --workspace=server -- google-token-verifier`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add server/src/users/google-oauth-client.provider.ts server/src/users/google-token-verifier.service.ts server/src/users/google-token-verifier.service.spec.ts
git commit -m "feat(server): verify Google ID tokens"
```

---

## Task 4: User upsert logic (TDD)

**Files:**
- Create: `server/src/users/users.service.ts`
- Test: `server/src/users/users.service.spec.ts`

**Interfaces:**
- Consumes: `GoogleProfile` from Task 3; `User` entity from Task 2.
- Produces: `UsersService` with `upsertFromGoogleProfile(profile: GoogleProfile): Promise<User>`, `loginWithGoogle(profile: GoogleProfile): Promise<{ accessToken: string; profileComplete: boolean }>`, `findById(id: string): Promise<User | null>`, `completePhone(id: string, phone: string): Promise<User>`. Task 6 (controller) and Task 7 (booking snapshot) both use this.

- [ ] **Step 1: Write the failing tests**

```ts
// server/src/users/users.service.spec.ts
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
    return { service: new UsersService(repo as never, jwt as never), repo };
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
    const service = new UsersService(repo as never, jwt as never);

    const result = await service.loginWithGoogle(profile);

    expect(result).toEqual({ accessToken: 'signed-token', profileComplete: false });
  });

  it('reports profileComplete=true when the user already has a phone', async () => {
    const existing = { id: 'u-1', googleId: 'g-1', email: 'ana@example.com', phone: '099123456' };
    const repo = { findOne: jest.fn().mockResolvedValue(existing), create: jest.fn(), save: jest.fn() };
    const jwt = { signAsync: jest.fn(async () => 'signed-token') };
    const service = new UsersService(repo as never, jwt as never);

    const result = await service.loginWithGoogle(profile);

    expect(result.profileComplete).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --workspace=server -- users.service`
Expected: FAIL — `Cannot find module './users.service'`

- [ ] **Step 3: Write the minimal implementation**

```ts
// server/src/users/users.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { GoogleProfile } from './google-token-verifier.service';

export interface GoogleLoginResult {
  accessToken: string;
  profileComplete: boolean;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    private readonly jwt: JwtService,
  ) {}

  async loginWithGoogle(profile: GoogleProfile): Promise<GoogleLoginResult> {
    const user = await this.upsertFromGoogleProfile(profile);
    const accessToken = await this.jwt.signAsync({ sub: user.id, email: user.email });
    return { accessToken, profileComplete: user.phone !== null };
  }

  async upsertFromGoogleProfile(profile: GoogleProfile): Promise<User> {
    let user = await this.usersRepo.findOne({ where: { googleId: profile.googleId } });
    if (user) return user;

    // Puede que ya exista una cuenta con este email pero sin googleId
    // vinculado (no debería pasar en la práctica) — la vinculamos en vez de
    // crear una cuenta duplicada.
    user = await this.usersRepo.findOne({ where: { email: profile.email } });
    if (user) {
      user.googleId = profile.googleId;
      user.name = profile.name;
      user.avatarUrl = profile.avatarUrl;
      return this.usersRepo.save(user);
    }

    return this.usersRepo.save(
      this.usersRepo.create({
        googleId: profile.googleId,
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
      }),
    );
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { id } });
  }

  async completePhone(id: string, phone: string): Promise<User> {
    const user = await this.usersRepo.findOneOrFail({ where: { id } });
    user.phone = phone;
    return this.usersRepo.save(user);
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test --workspace=server -- users.service`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add server/src/users/users.service.ts server/src/users/users.service.spec.ts
git commit -m "feat(server): user upsert-by-google-profile logic"
```

---

## Task 5: Customer JWT strategy, guard, and current-user decorator

**Files:**
- Create: `server/src/users/users.types.ts`
- Create: `server/src/users/strategies/user-jwt.strategy.ts`
- Create: `server/src/users/guards/user-jwt-auth.guard.ts`
- Create: `server/src/users/decorators/current-user.decorator.ts`

**Interfaces:**
- Consumes: `User` entity from Task 2.
- Produces: `UserJwtAuthGuard` (usable as `@UseGuards(UserJwtAuthGuard)`), `CurrentUser` param decorator returning `{ id: string; email: string }`, `AuthenticatedCustomer` type. Task 6 and Task 7 both use these.

- [ ] **Step 1: Write the shared types**

```ts
// server/src/users/users.types.ts
export interface UserJwtPayload {
  sub: string;
  email: string;
}

export interface AuthenticatedCustomer {
  id: string;
  email: string;
}
```

- [ ] **Step 2: Write the strategy**

```ts
// server/src/users/strategies/user-jwt.strategy.ts
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
```

Note the second argument `'user-jwt'` to `PassportStrategy(Strategy, 'user-jwt')` — this names the strategy distinctly from the admin one (which defaults to `'jwt'`), so `AuthGuard('user-jwt')` and `AuthGuard('jwt')` can coexist in the same app without colliding.

- [ ] **Step 3: Write the guard**

```ts
// server/src/users/guards/user-jwt-auth.guard.ts
import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class UserJwtAuthGuard extends AuthGuard('user-jwt') {
  handleRequest<TUser = unknown>(err: unknown, user: TUser): TUser {
    if (err || !user) throw new UnauthorizedException('No autorizado.');
    return user;
  }

  getRequest(context: ExecutionContext) {
    return context.switchToHttp().getRequest();
  }
}
```

- [ ] **Step 4: Write the decorator**

```ts
// server/src/users/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedCustomer } from '../users.types';

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthenticatedCustomer => {
  return ctx.switchToHttp().getRequest().user;
});
```

- [ ] **Step 5: Commit**

```bash
git add server/src/users/users.types.ts server/src/users/strategies/user-jwt.strategy.ts server/src/users/guards/user-jwt-auth.guard.ts server/src/users/decorators/current-user.decorator.ts
git commit -m "feat(server): customer JWT strategy, guard, and current-user decorator"
```

(No automated test here — this is thin framework wiring identical in shape to the already-working admin `JwtStrategy`/`JwtAuthGuard`; it's exercised end-to-end by curl in Task 6.)

---

## Task 6: Users module — Google login, profile, complete-profile endpoints

**Files:**
- Create: `server/src/users/dto/google-login.dto.ts`
- Create: `server/src/users/dto/complete-profile.dto.ts`
- Create: `server/src/users/users.controller.ts`
- Create: `server/src/users/users.module.ts`
- Modify: `server/src/app.module.ts`
- Modify: `.env.example` (repo root)

**Interfaces:**
- Consumes: `GoogleTokenVerifierService` (Task 3), `UsersService` (Task 4), `UserJwtAuthGuard`/`CurrentUser` (Task 5).
- Produces: `POST /api/users/auth/google`, `GET /api/users/me`, `PATCH /api/users/me` — used by the frontend starting in Task 10, and by Task 7's manual verification.

- [ ] **Step 1: Write the DTOs**

```ts
// server/src/users/dto/google-login.dto.ts
import { IsString, MinLength } from 'class-validator';

export class GoogleLoginDto {
  @IsString()
  @MinLength(10, { message: 'Credenciales inválidas.' })
  idToken: string;
}
```

```ts
// server/src/users/dto/complete-profile.dto.ts
import { Transform } from 'class-transformer';
import { IsString, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CompleteProfileDto {
  @Transform(trim)
  @IsString({ message: 'Ingresá un teléfono válido.' })
  @MinLength(6, { message: 'Ingresá un teléfono válido.' })
  phone: string;
}
```

- [ ] **Step 2: Write the controller**

```ts
// server/src/users/users.controller.ts
import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from './decorators/current-user.decorator';
import { CompleteProfileDto } from './dto/complete-profile.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { UserJwtAuthGuard } from './guards/user-jwt-auth.guard';
import { GoogleTokenVerifierService } from './google-token-verifier.service';
import { AuthenticatedCustomer } from './users.types';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly googleVerifier: GoogleTokenVerifierService,
  ) {}

  @Post('auth/google')
  @HttpCode(HttpStatus.OK)
  async loginWithGoogle(@Body() dto: GoogleLoginDto) {
    const profile = await this.googleVerifier.verify(dto.idToken);
    return this.usersService.loginWithGoogle(profile);
  }

  @Get('me')
  @UseGuards(UserJwtAuthGuard)
  async me(@CurrentUser() customer: AuthenticatedCustomer) {
    const user = await this.usersService.findById(customer.id);
    return { id: user!.id, email: user!.email, name: user!.name, phone: user!.phone, avatarUrl: user!.avatarUrl };
  }

  @Patch('me')
  @UseGuards(UserJwtAuthGuard)
  async completeProfile(@CurrentUser() customer: AuthenticatedCustomer, @Body() dto: CompleteProfileDto) {
    const user = await this.usersService.completePhone(customer.id, dto.phone);
    return { id: user.id, email: user.email, name: user.name, phone: user.phone, avatarUrl: user.avatarUrl };
  }
}
```

- [ ] **Step 3: Write the module**

```ts
// server/src/users/users.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from '../bookings/entities/booking.entity';
import { User } from './entities/user.entity';
import { googleOAuthClientProvider } from './google-oauth-client.provider';
import { GoogleTokenVerifierService } from './google-token-verifier.service';
import { UserJwtStrategy } from './strategies/user-jwt.strategy';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Booking]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('USER_JWT_SECRET'),
        signOptions: { expiresIn: '30d' },
      }),
    }),
  ],
  controllers: [UsersController],
  providers: [UsersService, GoogleTokenVerifierService, googleOAuthClientProvider, UserJwtStrategy],
  exports: [JwtModule, PassportModule, UsersService],
})
export class UsersModule {}
```

(`Booking` is imported here only so `TypeOrmModule.forFeature` can register its repository for Task 8's `GET /users/me/bookings` — `UsersModule` never imports `BookingsModule` itself, avoiding a cycle.)

- [ ] **Step 4: Wire into AppModule**

In `server/src/app.module.ts`, add the import and list it alongside the existing feature modules:
```ts
import { UsersModule } from './users/users.module';
// ...
imports: [
  ConfigModule.forRoot({ isGlobal: true, envFilePath: __dirname + '/../../.env' }),
  TypeOrmModule.forRootAsync({ /* ...unchanged... */ }),
  AuthModule,
  CatalogModule,
  BookingsModule,
  DiagModule,
  UsersModule,
],
```

- [ ] **Step 5: Add the new env vars**

In `.env.example` (repo root), add:
```
# Google OAuth — Client ID de un "OAuth 2.0 Client ID" tipo Web application
# en Google Cloud Console. El mismo valor va acá y en VITE_GOOGLE_CLIENT_ID.
GOOGLE_CLIENT_ID=

# Secreto para firmar los JWT de sesión de clientes (separado del JWT_SECRET
# de admin a propósito — los dos tipos de token nunca deben ser intercambiables).
USER_JWT_SECRET=

# Mismo valor que GOOGLE_CLIENT_ID, expuesto al front (los Client ID de Google
# no son secretos, están pensados para ir en código de cliente).
VITE_GOOGLE_CLIENT_ID=
```

Also add `GOOGLE_CLIENT_ID` and `USER_JWT_SECRET` to your local `.env`, and `VITE_GOOGLE_CLIENT_ID` too (same value as `GOOGLE_CLIENT_ID`). You'll need a real Google OAuth Client ID from Google Cloud Console (APIs & Services → Credentials → Create Credentials → OAuth client ID → Web application) to test the real Google flow later in Task 10 — for now any non-empty string unblocks the app from crashing on missing config, but token verification won't succeed against a fake ID.

- [ ] **Step 6: Manually verify — public login endpoint rejects a garbage token**

Start the backend: `npm run dev:server`

```bash
curl -s -X POST http://localhost:3001/api/users/auth/google \
  -H 'content-type: application/json' \
  -d '{"idToken":"not-a-real-token-but-long-enough"}'
```
Expected: `{"error":"Credenciales inválidas."}` with a `401` status.

- [ ] **Step 7: Manually verify — guarded routes reject missing tokens**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/api/users/me
```
Expected: `401`.

- [ ] **Step 8: Commit**

```bash
git add server/src/users/dto server/src/users/users.controller.ts server/src/users/users.module.ts server/src/app.module.ts .env.example
git commit -m "feat(server): Google login, profile, and complete-profile endpoints"
```

---

## Task 7: Bookings require a logged-in customer

**Files:**
- Modify: `server/src/bookings/entities/booking.entity.ts`
- Create: `server/src/migrations/1785894479939-AddUserIdToBookings.ts`
- Modify: `server/src/bookings/dto/create-booking.dto.ts`
- Modify: `server/src/bookings/bookings.service.ts`
- Modify: `server/src/bookings/bookings.controller.ts`
- Modify: `server/src/bookings/bookings.module.ts`
- Modify: `server/src/data-source.ts` (no change needed beyond Task 2's — confirming here it already includes both entities)

**Interfaces:**
- Consumes: `UserJwtAuthGuard`/`CurrentUser` (Task 5), `User` entity (Task 2).
- Produces: `POST /api/bookings` now requires a valid customer JWT; response shape unchanged (`{ id, date, time, service, emailSent }`).

- [ ] **Step 1: Add the column to the entity**

In `server/src/bookings/entities/booking.entity.ts`, add the import and column:
```ts
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { User } from '../../users/entities/user.entity';

// ...inside the class, alongside the other @Column fields:
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;
```

- [ ] **Step 2: Write the migration**

```ts
// server/src/migrations/1785894479939-AddUserIdToBookings.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

// Asume que la tabla "bookings" está vacía (no hay datos reales todavía en
// este proyecto) — si en algún momento eso deja de ser cierto, esta
// migración va a fallar de forma ruidosa en vez de corromper filas
// existentes, que es el comportamiento correcto.
export class AddUserIdToBookings1785894479939 implements MigrationInterface {
  name = 'AddUserIdToBookings1785894479939';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bookings"
      ADD COLUMN "user_id" uuid NOT NULL,
      ADD CONSTRAINT "FK_bookings_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bookings" DROP CONSTRAINT "FK_bookings_user_id", DROP COLUMN "user_id"`);
  }
}
```

- [ ] **Step 3: Update the create-booking DTO**

Replace the contents of `server/src/bookings/dto/create-booking.dto.ts` — remove `name`, `email`, `phone` entirely (they now come from the authenticated user, not the request body):
```ts
import { IsOptional, IsString } from 'class-validator';
import { IsIn } from 'class-validator';
import { SLOTS } from '../../catalog/catalog.constants';
import { IsBookingDate } from '../validators/is-booking-date';

export class CreateBookingDto {
  @IsBookingDate()
  date: string;

  @IsIn(SLOTS, { message: 'Bloque horario no disponible.' })
  time: string;

  // Sin @IsIn: si no está en SERVICIOS, BookingsService lo normaliza a
  // 'Recovery Room' en vez de rechazar la reserva — comportamiento heredado.
  @IsOptional()
  @IsString()
  service?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
```

- [ ] **Step 4: Update BookingsService to snapshot from the logged-in user**

Replace the top of `server/src/bookings/bookings.service.ts` (imports and constructor) with:

```ts
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { todayStr } from '../common/date.util';
import { SERVICIOS, SLOTS } from '../catalog/catalog.constants';
import { MailService } from '../mail/mail.service';
import { User } from '../users/entities/user.entity';
import { AvailabilityQueryDto } from './dto/availability-query.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { Booking } from './entities/booking.entity';
import { AvailabilityResponse, CancelBookingResponse, CreateBookingResponse } from './bookings.types';

const UNIQUE_VIOLATION_CODES = new Set(['23505', '23P01']);

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking) private readonly bookingsRepo: Repository<Booking>,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    private readonly mail: MailService,
  ) {}
```

(`getAvailability`, `findAllOrdered`, `cancel`, and `isUniqueViolation` are unchanged — only `create` and the constructor/imports change.) Replace the existing `create` method with:

```ts
async create(dto: CreateBookingDto, userId: string): Promise<CreateBookingResponse> {
  if (dto.date < todayStr()) throw new BadRequestException('No se puede reservar en una fecha pasada.');

  const user = await this.usersRepo.findOneOrFail({ where: { id: userId } });
  const service = (SERVICIOS as readonly string[]).includes(dto.service ?? '') ? (dto.service as string) : 'Recovery Room';

  let booking: Booking;
  try {
    booking = await this.bookingsRepo.save(
      this.bookingsRepo.create({
        date: dto.date,
        time: dto.time,
        name: user.name,
        email: user.email,
        phone: user.phone ?? '',
        service,
        notes: dto.notes || null,
        userId: user.id,
      }),
    );
  } catch (e) {
    if (this.isUniqueViolation(e)) {
      throw new ConflictException('Ese bloque ya fue reservado. Elegí otro horario.');
    }
    throw e;
  }

  const emailSent = await this.mail.enviar(this.mail.mailCliente(booking), this.mail.mailAdmin(booking)).catch(() => false);

  return { id: booking.id, date: booking.date, time: booking.time, service: booking.service, emailSent };
}
```

Add the import: `import { User } from '../users/entities/user.entity';`

- [ ] **Step 5: Update the controller to require and pass the customer**

In `server/src/bookings/bookings.controller.ts`:
```ts
import { UserJwtAuthGuard } from '../users/guards/user-jwt-auth.guard';
import { CurrentUser } from '../users/decorators/current-user.decorator';
import { AuthenticatedCustomer } from '../users/users.types';

// ...
  @Post()
  @UseGuards(UserJwtAuthGuard)
  create(@Body() dto: CreateBookingDto, @CurrentUser() customer: AuthenticatedCustomer): Promise<CreateBookingResponse> {
    return this.bookingsService.create(dto, customer.id);
  }
```

- [ ] **Step 6: Update the module**

In `server/src/bookings/bookings.module.ts`, import `UsersModule` (for the guard) and register `User` in `TypeOrmModule.forFeature`:
```ts
import { UsersModule } from '../users/users.module';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, User]), MailModule, AuthModule, UsersModule],
  controllers: [BookingsController, AvailabilityController],
  providers: [BookingsService],
})
export class BookingsModule {}
```

- [ ] **Step 7: Run the migration**

Run: `npm run migration:run --workspace=server`
Expected: `Migration AddUserIdToBookings1785894479939 has been executed successfully.`

- [ ] **Step 8: Manually verify end-to-end**

Since we don't have a real Google account to test with yet, mint a test user and a matching JWT directly:

```bash
# Insert a test user directly (adjust connection details to match your local .env)
psql "$DATABASE_URL" -c "INSERT INTO users (\"googleId\", email, name, phone) VALUES ('test-google-id', 'test@example.com', 'Test User', '099123456') RETURNING id;"
```

Copy the returned `id`, then mint a JWT for it (must match `USER_JWT_SECRET` from your `.env`):
```bash
node -e "
const jwt = require('jsonwebtoken');
console.log(jwt.sign({ sub: '<paste-id-here>', email: 'test@example.com' }, '<paste-USER_JWT_SECRET-here>', { expiresIn: '1d' }));
"
```
(`jsonwebtoken` is already a transitive dependency via `@nestjs/jwt`; if the bare `require` fails, run it from inside `server/` instead of the repo root.)

```bash
TOKEN="<paste the printed token>"
curl -s -X POST http://localhost:3001/api/bookings \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"date":"2026-12-01","time":"08:00","service":"Recovery Room"}'
```
Expected: `201` with `{"id":...,"date":"2026-12-01","time":"08:00","service":"Recovery Room","emailSent":true}`.

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3001/api/bookings \
  -H 'content-type: application/json' -d '{"date":"2026-12-01","time":"09:00"}'
```
Expected: `401` (no token at all).

- [ ] **Step 9: Commit**

```bash
git add server/src/bookings server/src/migrations/1785894479939-AddUserIdToBookings.ts
git commit -m "feat(server): booking creation requires a logged-in customer"
```

---

## Task 8: Customer's own bookings endpoint

**Files:**
- Modify: `server/src/users/users.controller.ts`
- Modify: `server/src/users/users.module.ts` (already imports `Booking` from Task 6 — no further change needed there)

**Interfaces:**
- Consumes: `Booking` entity (existing), `UserJwtAuthGuard`/`CurrentUser` (Task 5).
- Produces: `GET /api/users/me/bookings` → `Booking[]` scoped to the caller, ordered `date DESC, time DESC` (same ordering convention as the admin list). Used by Task 13's "mi cuenta" page.

- [ ] **Step 1: Add the repository and endpoint**

In `server/src/users/users.controller.ts`, add the injected repository and new method:
```ts
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from '../bookings/entities/booking.entity';

// ...inside the class:
  constructor(
    private readonly usersService: UsersService,
    private readonly googleVerifier: GoogleTokenVerifierService,
    @InjectRepository(Booking) private readonly bookingsRepo: Repository<Booking>,
  ) {}

  @Get('me/bookings')
  @UseGuards(UserJwtAuthGuard)
  getMyBookings(@CurrentUser() customer: AuthenticatedCustomer) {
    return this.bookingsRepo.find({ where: { userId: customer.id }, order: { date: 'DESC', time: 'DESC' } });
  }
```

- [ ] **Step 2: Manually verify**

Using the same test user/token from Task 7's verification:
```bash
curl -s http://localhost:3001/api/users/me/bookings -H "Authorization: Bearer $TOKEN"
```
Expected: a JSON array containing the booking created in Task 7's verification, and no bookings belonging to other users.

- [ ] **Step 3: Commit**

```bash
git add server/src/users/users.controller.ts
git commit -m "feat(server): expose a customer's own bookings"
```

---

## Task 9: Google Identity Services script + Sign-In button

**Files:**
- Modify: `index.html`
- Create: `src/components/auth/GoogleSignInButton/index.tsx`

**Interfaces:**
- Consumes: `import.meta.env.VITE_GOOGLE_CLIENT_ID`.
- Produces: `<GoogleSignInButton onCredential={(idToken: string) => void} />` — renders Google's button and calls back with the raw ID token. Used by Task 11 (booking gate) and any future login entry point.

- [ ] **Step 1: Add the Google script tag**

In `index.html`, inside `<head>`, add:
```html
<script src="https://accounts.google.com/gsi/client" async defer></script>
```

- [ ] **Step 2: Write the component**

```tsx
// src/components/auth/GoogleSignInButton/index.tsx
import { useEffect, useRef } from 'react';

// Tipado mínimo de lo que realmente usamos del SDK de Google Identity
// Services (no hay @types oficial liviano para esto).
interface GoogleCredentialResponse {
  credential: string;
}
interface GoogleIdApi {
  initialize(config: { client_id: string; callback: (response: GoogleCredentialResponse) => void }): void;
  renderButton(parent: HTMLElement, options: { theme: 'outline' | 'filled_black'; size: 'large' | 'medium'; text: 'signin_with' }): void;
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdApi } };
  }
}

interface GoogleSignInButtonProps {
  onCredential: (idToken: string) => void;
}

export const GoogleSignInButton = ({ onCredential }: GoogleSignInButtonProps): JSX.Element => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    let cancelled = false;

    const tryRender = () => {
      if (cancelled || !containerRef.current) return;
      if (!window.google) {
        setTimeout(tryRender, 100); // el script de Google carga async; reintenta hasta que esté listo
        return;
      }
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => onCredential(response.credential),
      });
      window.google.accounts.id.renderButton(containerRef.current, { theme: 'outline', size: 'large', text: 'signin_with' });
    };

    tryRender();
    return () => {
      cancelled = true;
    };
  }, [onCredential]);

  return <div ref={containerRef} />;
};
```

- [ ] **Step 3: Add the client ID typing**

In `src/vite-env.d.ts`, extend the env typing so `import.meta.env.VITE_GOOGLE_CLIENT_ID` is typed:
```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

- [ ] **Step 4: Commit**

```bash
git add index.html src/components/auth/GoogleSignInButton/index.tsx src/vite-env.d.ts
git commit -m "feat(web): Google Sign-In button"
```

(Verified visually once wired into a page in Task 11 — a bare button with no page using it yet isn't independently checkable.)

---

## Task 10: Customer auth state, axios instance, and RTK Query API

**Files:**
- Create: `src/types/user.types.ts`
- Create: `src/features/userAuth/userAuthSlice.ts`
- Create: `src/lib/userAxios.ts`
- Create: `src/lib/userAxiosBaseQuery.ts`
- Create: `src/features/api/userApi.ts`
- Modify: `src/store/store.ts`

**Interfaces:**
- Consumes: nothing from earlier frontend tasks.
- Produces: `useLoginWithGoogleMutation`, `useGetMeQuery`, `useCompleteProfileMutation`, `useGetMyBookingsQuery`, `selectIsCustomerAuthenticated`, `selectProfileComplete`, `credentialsSet`/`loggedOut` actions on the new slice. Used by Tasks 11–14.

- [ ] **Step 1: Write the shared types**

```ts
// src/types/user.types.ts
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  avatarUrl: string | null;
}

export interface GoogleLoginResponse {
  accessToken: string;
  profileComplete: boolean;
}
```

- [ ] **Step 2: Write the customer auth slice**

```ts
// src/features/userAuth/userAuthSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../../store/store';

const TOKEN_KEY = 'move_user_token';
const PROFILE_COMPLETE_KEY = 'move_user_profile_complete';

interface UserAuthState {
  token: string | null;
  profileComplete: boolean;
}

const initialState: UserAuthState = {
  token: localStorage.getItem(TOKEN_KEY),
  profileComplete: localStorage.getItem(PROFILE_COMPLETE_KEY) === 'true',
};

const userAuthSlice = createSlice({
  name: 'userAuth',
  initialState,
  reducers: {
    credentialsSet: (state, action: PayloadAction<{ token: string; profileComplete: boolean }>) => {
      state.token = action.payload.token;
      state.profileComplete = action.payload.profileComplete;
      localStorage.setItem(TOKEN_KEY, action.payload.token);
      localStorage.setItem(PROFILE_COMPLETE_KEY, String(action.payload.profileComplete));
    },
    profileCompleted: (state) => {
      state.profileComplete = true;
      localStorage.setItem(PROFILE_COMPLETE_KEY, 'true');
    },
    loggedOut: (state) => {
      state.token = null;
      state.profileComplete = false;
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(PROFILE_COMPLETE_KEY);
    },
  },
});

export const { credentialsSet, profileCompleted, loggedOut } = userAuthSlice.actions;
export const selectCustomerToken = (state: RootState): string | null => state.userAuth.token;
export const selectIsCustomerAuthenticated = (state: RootState): boolean => Boolean(state.userAuth.token);
export const selectProfileComplete = (state: RootState): boolean => state.userAuth.profileComplete;
export const userAuthReducer = userAuthSlice.reducer;
```

- [ ] **Step 3: Write the separate axios instance**

```ts
// src/lib/userAxios.ts
import axios, { AxiosError } from 'axios';
import { loggedOut } from '../features/userAuth/userAuthSlice';
import { store } from '../store/store';

export const userApiClient = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api' });

userApiClient.interceptors.request.use((config) => {
  const token = store.getState().userAuth.token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

userApiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) store.dispatch(loggedOut());
    return Promise.reject(error);
  },
);
```

- [ ] **Step 4: Write the RTK Query base query for this axios instance**

```ts
// src/lib/userAxiosBaseQuery.ts
import type { BaseQueryFn } from '@reduxjs/toolkit/query';
import type { AxiosError, AxiosRequestConfig, Method } from 'axios';
import { userApiClient } from './userAxios';
import type { ApiErrorShape } from './axiosBaseQuery';

export interface UserAxiosBaseQueryArgs {
  url: string;
  method: Method;
  data?: unknown;
  params?: unknown;
}

export const userAxiosBaseQuery = (): BaseQueryFn<UserAxiosBaseQueryArgs, unknown, ApiErrorShape> => {
  return async ({ url, method, data, params }) => {
    try {
      const result = await userApiClient({ url, method, data, params } as AxiosRequestConfig);
      return { data: result.data };
    } catch (err) {
      const axiosError = err as AxiosError<{ error?: string }>;
      return {
        error: {
          status: axiosError.response?.status,
          error: axiosError.response?.data?.error ?? 'Error de conexión. Intentá nuevamente.',
        },
      };
    }
  };
};
```

- [ ] **Step 5: Write the RTK Query API slice**

```ts
// src/features/api/userApi.ts
import { createApi } from '@reduxjs/toolkit/query/react';
import { userAxiosBaseQuery } from '../../lib/userAxiosBaseQuery';
import type { Booking, CreateBookingRequest, CreateBookingResponse } from '../../types/booking.types';
import type { GoogleLoginResponse, UserProfile } from '../../types/user.types';

export const userApi = createApi({
  reducerPath: 'userApi',
  baseQuery: userAxiosBaseQuery(),
  tagTypes: ['MyBookings'],
  endpoints: (builder) => ({
    loginWithGoogle: builder.mutation<GoogleLoginResponse, { idToken: string }>({
      query: (body) => ({ url: '/users/auth/google', method: 'POST', data: body }),
    }),
    getMe: builder.query<UserProfile, void>({
      query: () => ({ url: '/users/me', method: 'GET' }),
    }),
    completeProfile: builder.mutation<UserProfile, { phone: string }>({
      query: (body) => ({ url: '/users/me', method: 'PATCH', data: body }),
    }),
    getMyBookings: builder.query<Booking[], void>({
      query: () => ({ url: '/users/me/bookings', method: 'GET' }),
      providesTags: ['MyBookings'],
    }),
    createBooking: builder.mutation<CreateBookingResponse, CreateBookingRequest>({
      query: (body) => ({ url: '/bookings', method: 'POST', data: body }),
      invalidatesTags: ['MyBookings'],
    }),
  }),
});

export const {
  useLoginWithGoogleMutation,
  useGetMeQuery,
  useCompleteProfileMutation,
  useGetMyBookingsQuery,
  useCreateBookingMutation,
} = userApi;
```

Note: `CreateBookingRequest` (in `src/types/booking.types.ts`) currently includes `name`/`email`/`phone` fields — Task 14 removes those from the type since the backend no longer accepts them.

- [ ] **Step 6: Wire the new slice and API into the store**

In `src/store/store.ts`:
```ts
import { userAuthReducer } from '../features/userAuth/userAuthSlice';
import { userApi } from '../features/api/userApi';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    userAuth: userAuthReducer,
    [baseApi.reducerPath]: baseApi.reducer,
    [userApi.reducerPath]: userApi.reducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware, userApi.middleware),
});
```

- [ ] **Step 7: Commit**

```bash
git add src/types/user.types.ts src/features/userAuth src/lib/userAxios.ts src/lib/userAxiosBaseQuery.ts src/features/api/userApi.ts src/store/store.ts
git commit -m "feat(web): customer auth state, axios instance, and RTK Query API"
```

(No automated test — this mirrors the already-working admin auth plumbing exactly; verified end-to-end once a page actually uses it, in Task 11.)

---

## Task 11: Remove createBooking from the admin API; update useBookingFlow

**Files:**
- Modify: `src/features/api/bookingsApi.ts`
- Modify: `src/hooks/useBookingFlow.ts`
- Modify: `src/types/booking.types.ts`

**Interfaces:**
- Consumes: `useCreateBookingMutation` now from `userApi` (Task 10) instead of `bookingsApi`.
- Produces: `bookingsApi` retains only `getBookings`/`cancelBooking` (admin-only).

- [ ] **Step 1: Remove the name/email/phone fields from the request type**

In `src/types/booking.types.ts`, change:
```ts
export interface CreateBookingRequest {
  date: string;
  time: string;
  service: string;
  notes?: string;
}
```

- [ ] **Step 2: Remove `createBooking` from the admin bookings API**

In `src/features/api/bookingsApi.ts`, delete the `createBooking` endpoint and its type imports, leaving only `getBookings` and `cancelBooking`:
```ts
import type { Booking, CancelBookingResponse } from '../../types/booking.types';
import { baseApi } from './baseApi';

export const bookingsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getBookings: builder.query<Booking[], void>({
      query: () => ({ url: '/bookings', method: 'GET' }),
      providesTags: ['Booking'],
    }),
    cancelBooking: builder.mutation<CancelBookingResponse, { id: number; notify: boolean }>({
      query: ({ id, notify }) => ({ url: '/bookings', method: 'DELETE', params: { id, notify: notify ? 1 : 0 } }),
      invalidatesTags: ['Booking'],
    }),
  }),
});

export const { useGetBookingsQuery, useCancelBookingMutation } = bookingsApi;
```

- [ ] **Step 3: Point useBookingFlow at the new mutation**

In `src/hooks/useBookingFlow.ts`, change the import:
```ts
import { useCreateBookingMutation } from '../features/api/userApi';
```
(replacing the old `import { useCreateBookingMutation } from '../features/api/bookingsApi';`). No other changes needed in this file — the hook's `submitBooking` call shape (`{...values, date, time, service}`) already matches the trimmed `CreateBookingRequest`, since `values: ClientFieldsValues` gets trimmed to just `notes` in Task 14.

- [ ] **Step 4: Verify the frontend still typechecks**

Run: `npx tsc -b --noEmit`
Expected: exits 0. (It will still reference the old `ClientFieldsValues` shape with name/email/phone until Task 14 — if that causes a type error here, it's fine to leave it failing until Task 14 completes; note it and continue, since Task 14 fixes the schema in the same area.)

- [ ] **Step 5: Commit**

```bash
git add src/types/booking.types.ts src/features/api/bookingsApi.ts src/hooks/useBookingFlow.ts
git commit -m "refactor(web): move booking creation to the customer API"
```

---

## Task 12: Complete-profile page

**Files:**
- Create: `src/pages/CompleteProfilePage/index.tsx`
- Create: `src/routes/RequireUserAuth/index.tsx`
- Modify: `src/routes/router.tsx`

**Interfaces:**
- Consumes: `useCompleteProfileMutation` (Task 10), `selectIsCustomerAuthenticated`/`selectProfileComplete`/`profileCompleted` (Task 10).
- Produces: `/completar-perfil` route, reachable only while logged in.

- [ ] **Step 1: Write the route guard**

```tsx
// src/routes/RequireUserAuth/index.tsx
import { Navigate, Outlet } from 'react-router-dom';
import { selectIsCustomerAuthenticated } from '../../features/userAuth/userAuthSlice';
import { useAppSelector } from '../../store/hooks';

export const RequireUserAuth = (): JSX.Element => {
  const isAuthenticated = useAppSelector(selectIsCustomerAuthenticated);
  if (!isAuthenticated) return <Navigate to="/" replace />;
  return <Outlet />;
};
```

- [ ] **Step 2: Write the page**

```tsx
// src/pages/CompleteProfilePage/index.tsx
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useCompleteProfileMutation } from '../../features/api/userApi';
import { profileCompleted } from '../../features/userAuth/userAuthSlice';
import { extractApiErrorMessage } from '../../lib/apiError';
import { useAppDispatch } from '../../store/hooks';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';

const phoneSchema = z.object({ phone: z.string().trim().min(6, 'Ingresá un teléfono válido.') });
type PhoneFormValues = z.infer<typeof phoneSchema>;

export const CompleteProfilePage = (): JSX.Element => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [completeProfile, { isLoading }] = useCompleteProfileMutation();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors } } = useForm<PhoneFormValues>({ resolver: zodResolver(phoneSchema) });

  const submit = handleSubmit(async (values) => {
    setError(null);
    try {
      await completeProfile(values).unwrap();
      dispatch(profileCompleted());
      navigate('/', { replace: true });
    } catch (err) {
      setError(extractApiErrorMessage(err));
    }
  });

  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <form onSubmit={submit} className="w-full max-w-sm rounded-lg border border-border bg-card p-8">
        <h1 className="mb-2 font-heading text-xl uppercase tracking-wide">Completá tu perfil</h1>
        <p className="mb-6 text-sm text-muted-foreground">Necesitamos tu teléfono para poder avisarte sobre tus reservas.</p>

        <div className="mb-5">
          <Label htmlFor="profile-phone">Teléfono / WhatsApp</Label>
          <Input id="profile-phone" type="tel" {...register('phone')} />
          {errors.phone && <p className="mt-1 text-xs text-destructive">{errors.phone.message}</p>}
        </div>

        <Button type="submit" size="block" disabled={isLoading}>
          {isLoading ? 'Guardando…' : 'Continuar'}
        </Button>
        {error && <p className="mt-3.5 text-sm text-destructive">{error}</p>}
      </form>
    </div>
  );
};
```

- [ ] **Step 3: Add the route**

In `src/routes/router.tsx`, add before the `'*'` catch-all:
```tsx
{
  path: '/completar-perfil',
  element: <RequireUserAuth />,
  children: [
    {
      index: true,
      lazy: async () => {
        const { CompleteProfilePage } = await import('../pages/CompleteProfilePage');
        return { Component: CompleteProfilePage };
      },
    },
  ],
},
```
And import `RequireUserAuth` at the top of the file alongside the existing `RequireAuth` import.

- [ ] **Step 4: Commit**

```bash
git add src/pages/CompleteProfilePage src/routes/RequireUserAuth src/routes/router.tsx
git commit -m "feat(web): profile-completion page"
```

(Verified visually together with the login flow in Task 14's final browser pass — this page has no reachable entry point until the login button exists.)

---

## Task 13: "Mi cuenta" page

**Files:**
- Create: `src/pages/MiCuentaPage/index.tsx`
- Modify: `src/routes/router.tsx`

**Interfaces:**
- Consumes: `useGetMeQuery`, `useGetMyBookingsQuery` (Task 10).
- Produces: `/mi-cuenta` route.

- [ ] **Step 1: Write the page**

```tsx
// src/pages/MiCuentaPage/index.tsx
import { useMemo } from 'react';
import { useGetMeQuery, useGetMyBookingsQuery } from '../../features/api/userApi';
import { fechaCorta, todayStr } from '../../lib/dateUtils';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { Badge } from '../../components/ui/badge';
import { Card } from '../../components/ui/card';

export const MiCuentaPage = (): JSX.Element => {
  useDocumentTitle('Mi cuenta · MOVE®');
  const { data: me } = useGetMeQuery();
  const { data: bookings = [] } = useGetMyBookingsQuery();

  const { upcoming, past } = useMemo(() => {
    const hoy = todayStr();
    return {
      upcoming: bookings.filter((b) => b.date >= hoy).sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)),
      past: bookings.filter((b) => b.date < hoy).sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)),
    };
  }, [bookings]);

  return (
    <div className="mx-auto max-w-site space-y-8 px-8 py-12 max-md:px-5">
      <div>
        <h1 className="font-heading text-2xl uppercase tracking-wide">Hola, {me?.name?.split(' ')[0]}</h1>
        <p className="text-sm text-muted-foreground">{me?.email}</p>
      </div>

      <Card className="p-6">
        <h2 className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Tu plan</h2>
        <p className="text-foreground">Sin plan activo todavía.</p>
      </Card>

      <div>
        <h2 className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">Próximas reservas</h2>
        {upcoming.length === 0 && <p className="text-sm text-muted-foreground">No tenés reservas próximas.</p>}
        <div className="space-y-2">
          {upcoming.map((b) => (
            <Card key={b.id} className="flex items-center justify-between p-4">
              <div>
                <p>{fechaCorta(b.date)} · {b.time} h</p>
                <p className="text-xs text-muted-foreground">{b.service}</p>
              </div>
              <Badge>{b.service}</Badge>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">Reservas pasadas</h2>
        {past.length === 0 && <p className="text-sm text-muted-foreground">Todavía no tenés reservas pasadas.</p>}
        <div className="space-y-2 opacity-60">
          {past.map((b) => (
            <Card key={b.id} className="flex items-center justify-between p-4">
              <div>
                <p>{fechaCorta(b.date)} · {b.time} h</p>
                <p className="text-xs text-muted-foreground">{b.service}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Add the route**

In `src/routes/router.tsx`, add a route protected by both login and profile-completeness. Add this helper component inline in the router file (or as its own tiny file if preferred) since it's a two-condition guard specific to this route:
```tsx
{
  path: '/mi-cuenta',
  element: <RequireUserAuth />,
  children: [
    {
      index: true,
      lazy: async () => {
        const { MiCuentaPage } = await import('../pages/MiCuentaPage');
        return { Component: MiCuentaPage };
      },
    },
  ],
},
```
(`RequireUserAuth` only checks login, not profile-completeness — that's acceptable here: a logged-in-but-incomplete user hitting `/mi-cuenta` directly will simply see `phone: null`/an empty bookings list rather than being blocked, since they'd have already been routed to `/completar-perfil` right after login per Task 14. Revisit if this proves confusing in practice.)

- [ ] **Step 3: Commit**

```bash
git add src/pages/MiCuentaPage src/routes/router.tsx
git commit -m "feat(web): mi cuenta page"
```

---

## Task 14: Gate booking behind login; shrink the booking form; wire the login flow

**Files:**
- Modify: `src/schemas/booking.schema.ts`
- Modify: `src/components/booking/BookingForm/index.tsx`
- Modify: `src/components/booking/BookingSection/index.tsx`
- Create: `src/hooks/useGoogleAuth.ts`

**Interfaces:**
- Consumes: `GoogleSignInButton` (Task 9), `useLoginWithGoogleMutation` (Task 10), `credentialsSet` (Task 10).
- Produces: fully working login → complete-profile → book flow.

- [ ] **Step 1: Shrink the client-fields schema**

Replace the contents of `src/schemas/booking.schema.ts`:
```ts
import { z } from 'zod';

export const SLOTS = ['07:00', '08:00', '09:00', '10:00', '15:00', '16:00', '17:00', '18:00', '19:00'] as const;
export const SERVICIOS = [
  'Recovery Room', 'Presoterapia', 'Luz roja e infrarroja',
  'Sauna infrarrojo', 'Sillón gravedad cero', 'Meditación y respiración',
] as const;

export const clientFieldsSchema = z.object({
  notes: z.string().optional(),
});

export type ClientFieldsValues = z.infer<typeof clientFieldsSchema>;
```

- [ ] **Step 2: Shrink the booking form**

In `src/components/booking/BookingForm/index.tsx`, remove the name/email/phone `<Input>` blocks and their `register(...)`/error-message JSX, keeping only the notes `<Textarea>`, the `SelectedSlotSummary`, the submit button, and the success/error message — the `onSubmit`/`useForm` wiring stays the same shape since `ClientFieldsValues` now only has `notes`.

- [ ] **Step 3: Write the login orchestration hook**

```ts
// src/hooks/useGoogleAuth.ts
import { useNavigate } from 'react-router-dom';
import { useLoginWithGoogleMutation } from '../features/api/userApi';
import { credentialsSet } from '../features/userAuth/userAuthSlice';
import { useAppDispatch } from '../store/hooks';

export function useGoogleAuth() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [loginWithGoogle, { isLoading }] = useLoginWithGoogleMutation();

  const handleCredential = async (idToken: string) => {
    const { accessToken, profileComplete } = await loginWithGoogle({ idToken }).unwrap();
    dispatch(credentialsSet({ token: accessToken, profileComplete }));
    if (!profileComplete) navigate('/completar-perfil');
  };

  return { handleCredential, isLoading };
}
```

- [ ] **Step 4: Gate the booking section**

In `src/components/booking/BookingSection/index.tsx`, add the login gate around the existing two-column layout:
```tsx
import { GoogleSignInButton } from '../../auth/GoogleSignInButton';
import { useGoogleAuth } from '../../../hooks/useGoogleAuth';
import { selectIsCustomerAuthenticated } from '../../../features/userAuth/userAuthSlice';
import { useAppSelector } from '../../../store/hooks';

// ...inside the component, before the returned JSX's grid:
  const isAuthenticated = useAppSelector(selectIsCustomerAuthenticated);
  const { handleCredential } = useGoogleAuth();

  if (!isAuthenticated) {
    return (
      <section id="reservar" className="mx-auto max-w-site border-b border-border px-8 py-24 text-center max-md:px-5 max-md:py-16">
        <SectionHeading tag="05 — Reservá tu hora">Recovery Room · Turnos</SectionHeading>
        <p className="mx-auto mb-8 max-w-[480px] text-lg text-neutral-300">Iniciá sesión con Google para reservar tu turno.</p>
        <div className="flex justify-center">
          <GoogleSignInButton onCredential={handleCredential} />
        </div>
      </section>
    );
  }
```
(the existing grid-based JSX becomes the function's fallthrough return, unchanged otherwise)

- [ ] **Step 5: Full manual verification with a real Google account**

This is the first point where a real `GOOGLE_CLIENT_ID`/`VITE_GOOGLE_CLIENT_ID` pair matters. In Google Cloud Console: APIs & Services → Credentials → Create Credentials → OAuth client ID → Web application. Add `http://localhost:5173` under Authorized JavaScript origins. Put the resulting Client ID in both `.env` (`GOOGLE_CLIENT_ID`) and as `VITE_GOOGLE_CLIENT_ID`.

Start both dev servers (`npm run dev:server`, `npm run dev`) and in a real browser:
1. Go to `http://localhost:5173/#reservar` — confirm the Google button renders instead of the booking form.
2. Click it, complete a real Google sign-in.
3. Confirm redirect to `/completar-perfil`, submit a phone number, confirm redirect back to `/`.
4. Scroll to `#reservar` again — confirm the full booking form (service/date/time/notes only) now renders.
5. Make a booking; confirm success message.
6. Go to `/mi-cuenta` — confirm the booking appears under "Próximas reservas" with the right date/time/service.
7. Reload the page — confirm you're still logged in (token persisted).

- [ ] **Step 6: Commit**

```bash
git add src/schemas/booking.schema.ts src/components/booking/BookingForm/index.tsx src/components/booking/BookingSection/index.tsx src/hooks/useGoogleAuth.ts
git commit -m "feat(web): gate booking behind Google login end to end"
```

---

## Self-Review Notes

- **Spec coverage:** every section of the design doc maps to a task — data model (Tasks 2, 7), Google auth architecture (Tasks 3–6), booking-flow changes (Task 7), profile/bookings API (Task 8), frontend login UI (Tasks 9, 14), profile completion (Task 12), mi cuenta (Task 13), form shrink (Task 14). Out-of-scope items (plans, MercadoPago, socio admin UI, self-service cancellation) are explicitly not present anywhere in this plan, matching the spec's "Out of scope" section.
- **Type consistency checked:** `AuthenticatedCustomer { id, email }` (Task 5) is the exact shape returned by `@CurrentUser()` and consumed in Tasks 6, 7, 8. `GoogleProfile { googleId, email, name, avatarUrl }` (Task 3) is the exact shape produced by `GoogleTokenVerifierService.verify` and consumed by `UsersService.upsertFromGoogleProfile`/`loginWithGoogle` (Task 4). `GoogleLoginResponse { accessToken, profileComplete }` (frontend, Task 10) matches the controller's return shape from `UsersService.loginWithGoogle` (Task 4/6).
- **No circular module dependency:** confirmed in the File Structure section — `BookingsModule` → `UsersModule` is the only cross-module import between the two; `UsersModule` never imports `BookingsModule`.
