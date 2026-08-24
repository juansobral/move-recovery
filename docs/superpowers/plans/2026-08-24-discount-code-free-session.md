# Discount Code Free Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin configure one global discount code that grants each user exactly one free session (any catalog service, no payment), shared via a `?promo=CODE` link, plus surface the existing socio 50% discount as visible copy in the booking flow and admin pricing page.

**Architecture:** A new `DiscountCodesModule` (mirrors `PricingModule`) owns a singleton `discount_code_settings` row (`code`, `active`). `UsersService` gains an atomic conditional-`UPDATE` pair (`tryRedeemFreeSession`/`restoreFreeSession`) on a new `users.free_session_redeemed_at` column, mirroring `SubscriptionsService.tryConsumeCredit`/`restoreCredit`. `PaymentsController.checkoutBooking` gets one new branch — between the existing credit check and the paid MercadoPago fallback — that validates the submitted code and, on success, creates the booking directly like the credits path does. The frontend reads `?promo=` once in `useBookingFlow`, threads it into `PaymentChoice`, and reuses the existing `submitBooking`/checkout endpoint with an added `discountCode` field — no new frontend endpoint.

**Tech Stack:** NestJS + TypeORM (Postgres) on the backend, jest for backend unit tests; React + Redux Toolkit (RTK Query) + react-hook-form/Zod on the frontend, no frontend test runner in this repo.

**Spec:** `docs/superpowers/specs/2026-08-24-discount-code-free-session-design.md`

## Global Constraints

- All user-facing error messages are in Spanish and thrown as NestJS `HttpException`s (`BadRequestException`, `ConflictException`) — the existing `HttpExceptionFilter` automatically reshapes them to `{ error: '<mensaje>' }`; never construct that shape by hand.
- Admin endpoints use `JwtAuthGuard` (`server/src/auth/guards/jwt-auth.guard.ts`), same as `PricingController`. Customer endpoints keep the existing `UserJwtAuthGuard` on `checkoutBooking` — unchanged.
- Migrations are hand-written SQL in `server/src/migrations/*.ts` (not generated) — new timestamps must sort after the latest existing one, `1785894900000`.
- One NestJS module per domain (entity + service + controller + dto + module) — `server/src/discount-codes/` mirrors `server/src/pricing/` exactly.
- Any atomic per-user state change (redeem, restore) is a conditional `UPDATE ... WHERE ...` via `createQueryBuilder()`, never read-then-write — mirrors `SubscriptionsService.tryConsumeCredit`/`restoreCredit`.
- Single global discount code, no expiration date, no total-usage cap — only an `active` boolean and a case/whitespace-insensitive string match.
- One free-session redemption **total per user, ever** — tracked as `users.free_session_redeemed_at`, not per-code.
- The discount-code input only renders in the frontend when the visitor arrived via `?promo=` — never a public "have a code?" affordance shown to everyone.
- No frontend test runner exists in this repo — frontend task verification is `npm run build` (type-check across both workspaces) plus the manual browser smoke test in the final task, not automated tests.
- Backend tests use Jest with hand-mocked repositories (`{ ... } as never`), following the existing style in `subscriptions.service.spec.ts`/`users.service.spec.ts` — no test database is used.

---

### Task 1: Migrations — discount code settings table + users column

**Files:**
- Create: `server/src/migrations/1785895000000-CreateDiscountCodeSettings.ts`
- Create: `server/src/migrations/1785895000001-AddFreeSessionRedeemedAtToUsers.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: DB table `discount_code_settings` (`id uuid`, `code text`, `active boolean`, `updated_at timestamptz`), seeded with one row (`code=''`, `active=false`). DB column `users.free_session_redeemed_at timestamptz NULL`. Task 2 and Task 3 map TypeORM entities onto these.

- [ ] **Step 1: Write the `discount_code_settings` migration**

```ts
// server/src/migrations/1785895000000-CreateDiscountCodeSettings.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDiscountCodeSettings1785895000000 implements MigrationInterface {
  name = 'CreateDiscountCodeSettings1785895000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "discount_code_settings" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" text NOT NULL,
        "active" boolean NOT NULL DEFAULT false,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_discount_code_settings_id" PRIMARY KEY ("id")
      )
    `);
    // Fila única, inactiva hasta que un admin cargue un código real — mismo
    // patrón que pricing_settings (una sola fila, nunca vacía).
    await queryRunner.query(`INSERT INTO "discount_code_settings" ("code", "active") VALUES ('', false)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "discount_code_settings"`);
  }
}
```

- [ ] **Step 2: Write the `users.free_session_redeemed_at` migration**

```ts
// server/src/migrations/1785895000001-AddFreeSessionRedeemedAtToUsers.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFreeSessionRedeemedAtToUsers1785895000001 implements MigrationInterface {
  name = 'AddFreeSessionRedeemedAtToUsers1785895000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "free_session_redeemed_at" TIMESTAMPTZ NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "free_session_redeemed_at"`);
  }
}
```

- [ ] **Step 3: Type-check the migrations**

Run: `npm run build --workspace=server`
Expected: build succeeds (migrations compile as plain TypeScript; there is no DB connection at build time).

- [ ] **Step 4: Run the migrations against a real database, if one is configured**

Run: `npm run migration:run --workspace=server`
Expected: `CreateDiscountCodeSettings1785895000000` and `AddFreeSessionRedeemedAtToUsers1785895000001` both print as applied. If no `DATABASE_URL` is reachable in this environment, skip this step and note it in the handoff — the migrations must still be run against the real dev/staging DB before this feature works end-to-end.

- [ ] **Step 5: Commit**

```bash
git add server/src/migrations/1785895000000-CreateDiscountCodeSettings.ts server/src/migrations/1785895000001-AddFreeSessionRedeemedAtToUsers.ts
git commit -m "feat: add discount_code_settings table and users.free_session_redeemed_at column"
```

---

### Task 2: UsersService atomic free-session redemption

**Files:**
- Modify: `server/src/users/entities/user.entity.ts`
- Modify: `server/src/users/users.service.ts`
- Test: `server/src/users/users.service.spec.ts` (append to existing file)

**Interfaces:**
- Consumes: `users.free_session_redeemed_at` column from Task 1 (runtime only — not needed for these mocked-repo unit tests).
- Produces: `UsersService.tryRedeemFreeSession(userId: string): Promise<boolean>`, `UsersService.restoreFreeSession(userId: string): Promise<void>` — Task 4 (`PaymentsController`) calls both.

- [ ] **Step 1: Write the failing tests**

Append to the end of `server/src/users/users.service.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test --workspace=server -- users.service.spec.ts`
Expected: FAIL — `tryRedeemFreeSession`/`restoreFreeSession` are not functions on `UsersService`.

- [ ] **Step 3: Add the entity column**

In `server/src/users/entities/user.entity.ts`, add after the `isSocio` column:

```ts
  @Column({ name: 'free_session_redeemed_at', type: 'timestamptz', nullable: true })
  freeSessionRedeemedAt: Date | null;
```

- [ ] **Step 4: Implement the service methods**

In `server/src/users/users.service.ts`, add after `setSocio`:

```ts
  // UPDATE condicional atómico — mismo patrón que
  // SubscriptionsService.tryConsumeCredit: el "¿ya lo usó?" y el marcado
  // pasan en la misma sentencia, así dos reservas simultáneas del mismo
  // usuario no pueden consumir la sesión gratis dos veces.
  async tryRedeemFreeSession(userId: string): Promise<boolean> {
    const result = await this.usersRepo
      .createQueryBuilder()
      .update(User)
      .set({ freeSessionRedeemedAt: () => 'now()' })
      .where('id = :id AND free_session_redeemed_at IS NULL', { id: userId })
      .execute();
    return (result.affected ?? 0) > 0;
  }

  // Compensación de tryRedeemFreeSession: si la reserva que iba a usar la
  // sesión gratis falla, la devolvemos.
  async restoreFreeSession(userId: string): Promise<void> {
    await this.usersRepo
      .createQueryBuilder()
      .update(User)
      .set({ freeSessionRedeemedAt: null })
      .where('id = :id', { id: userId })
      .execute();
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test --workspace=server -- users.service.spec.ts`
Expected: PASS (all describe blocks in the file, including the pre-existing ones).

- [ ] **Step 6: Commit**

```bash
git add server/src/users/entities/user.entity.ts server/src/users/users.service.ts server/src/users/users.service.spec.ts
git commit -m "feat: add atomic free-session redemption to UsersService"
```

---

### Task 3: DiscountCodesModule (entity, service, controller)

**Files:**
- Create: `server/src/discount-codes/entities/discount-code-settings.entity.ts`
- Create: `server/src/discount-codes/dto/update-discount-code.dto.ts`
- Create: `server/src/discount-codes/discount-codes.service.ts`
- Create: `server/src/discount-codes/discount-codes.controller.ts`
- Create: `server/src/discount-codes/discount-codes.module.ts`
- Modify: `server/src/app.module.ts`
- Test: `server/src/discount-codes/discount-codes.service.spec.ts`

**Interfaces:**
- Consumes: `discount_code_settings` table from Task 1.
- Produces: `DiscountCodesService.isCodeValid(submitted: string): Promise<boolean>` — Task 4 calls this. `GET`/`PUT /api/admin/discount-code` — Task 5's `discountCodeApi.ts` calls this.

- [ ] **Step 1: Write the failing test**

```ts
// server/src/discount-codes/discount-codes.service.spec.ts
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --workspace=server -- discount-codes.service.spec.ts`
Expected: FAIL — cannot find module `./discount-codes.service` (it doesn't exist yet).

- [ ] **Step 3: Write the entity**

```ts
// server/src/discount-codes/entities/discount-code-settings.entity.ts
import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('discount_code_settings')
export class DiscountCodeSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  code: string;

  @Column({ type: 'boolean', default: false })
  active: boolean;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
```

- [ ] **Step 4: Write the DTO**

```ts
// server/src/discount-codes/dto/update-discount-code.dto.ts
import { IsBoolean, IsString } from 'class-validator';

export class UpdateDiscountCodeDto {
  @IsString({ message: 'El código debe ser texto.' })
  code: string;

  @IsBoolean({ message: 'El estado activo debe ser verdadero o falso.' })
  active: boolean;
}
```

- [ ] **Step 5: Implement the service**

```ts
// server/src/discount-codes/discount-codes.service.ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UpdateDiscountCodeDto } from './dto/update-discount-code.dto';
import { DiscountCodeSettings } from './entities/discount-code-settings.entity';

@Injectable()
export class DiscountCodesService {
  constructor(@InjectRepository(DiscountCodeSettings) private readonly repo: Repository<DiscountCodeSettings>) {}

  async getCurrent(): Promise<DiscountCodeSettings> {
    const [current] = await this.repo.find({ take: 1 });
    // No debería pasar post-migración — si pasa, la migración no corrió.
    if (!current) throw new InternalServerErrorException('No hay código de descuento configurado.');
    return current;
  }

  async update(dto: UpdateDiscountCodeDto): Promise<DiscountCodeSettings> {
    const current = await this.getCurrent();
    Object.assign(current, dto);
    return this.repo.save(current);
  }

  async isCodeValid(submitted: string): Promise<boolean> {
    const current = await this.getCurrent();
    if (!current.active) return false;
    return submitted.trim().toLowerCase() === current.code.trim().toLowerCase();
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test --workspace=server -- discount-codes.service.spec.ts`
Expected: PASS.

- [ ] **Step 7: Write the controller**

```ts
// server/src/discount-codes/discount-codes.controller.ts
import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DiscountCodesService } from './discount-codes.service';
import { UpdateDiscountCodeDto } from './dto/update-discount-code.dto';
import { DiscountCodeSettings } from './entities/discount-code-settings.entity';

@Controller('admin/discount-code')
@UseGuards(JwtAuthGuard)
export class DiscountCodesController {
  constructor(private readonly discountCodesService: DiscountCodesService) {}

  @Get()
  getCurrent(): Promise<DiscountCodeSettings> {
    return this.discountCodesService.getCurrent();
  }

  @Put()
  update(@Body() dto: UpdateDiscountCodeDto): Promise<DiscountCodeSettings> {
    return this.discountCodesService.update(dto);
  }
}
```

- [ ] **Step 8: Write the module**

```ts
// server/src/discount-codes/discount-codes.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DiscountCodesController } from './discount-codes.controller';
import { DiscountCodesService } from './discount-codes.service';
import { DiscountCodeSettings } from './entities/discount-code-settings.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DiscountCodeSettings])],
  controllers: [DiscountCodesController],
  providers: [DiscountCodesService],
  exports: [DiscountCodesService],
})
export class DiscountCodesModule {}
```

- [ ] **Step 9: Register the module and entity in `app.module.ts`**

In `server/src/app.module.ts`, add imports:

```ts
import { DiscountCodeSettings } from './discount-codes/entities/discount-code-settings.entity';
import { DiscountCodesModule } from './discount-codes/discount-codes.module';
```

Add `DiscountCodeSettings` to the `entities` array (alongside `PricingSettings`):

```ts
        entities: [AdminUser, Booking, User, Subscription, CheckoutIntent, PricingSettings, DiscountCodeSettings],
```

Add `DiscountCodesModule` to the top-level `imports` array (alongside `PricingModule`):

```ts
    PricingModule,
    DiscountCodesModule,
    PaymentsModule,
```

- [ ] **Step 10: Build to verify wiring compiles**

Run: `npm run build --workspace=server`
Expected: build succeeds.

- [ ] **Step 11: Commit**

```bash
git add server/src/discount-codes server/src/app.module.ts
git commit -m "feat: add DiscountCodesModule with admin GET/PUT for the global discount code"
```

---

### Task 4: Wire redemption into the checkout flow

**Files:**
- Modify: `server/src/payments/dto/create-checkout.dto.ts`
- Modify: `server/src/payments/payments.controller.ts`
- Modify: `server/src/payments/payments.module.ts`
- Test: `server/src/payments/payments.controller.spec.ts` (new)

**Interfaces:**
- Consumes: `UsersService.tryRedeemFreeSession`/`restoreFreeSession` (Task 2), `DiscountCodesService.isCodeValid` (Task 3).
- Produces: `POST /bookings/checkout` accepts an optional `discountCode` field and, when valid and unused, creates the booking without requiring payment. Task 6's frontend `submitBooking` call relies on this.

- [ ] **Step 1: Write the failing tests**

```ts
// server/src/payments/payments.controller.spec.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test --workspace=server -- payments.controller.spec.ts`
Expected: FAIL — `PaymentsController` constructor doesn't accept a `discountCodesService` argument yet (TypeScript arity mismatch caught by ts-jest), and `dto.discountCode` is not read anywhere.

- [ ] **Step 3: Add `discountCode` to the checkout DTO**

In `server/src/payments/dto/create-checkout.dto.ts`, add:

```ts
  @IsOptional()
  @IsString()
  discountCode?: string;
```

- [ ] **Step 4: Wire `DiscountCodesService` into the controller**

In `server/src/payments/payments.controller.ts`, add the import:

```ts
import { DiscountCodesService } from '../discount-codes/discount-codes.service';
```

Update the constructor to include `discountCodesService` right after `pricingService`:

```ts
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly usersService: UsersService,
    private readonly pricingService: PricingService,
    private readonly discountCodesService: DiscountCodesService,
    private readonly checkoutReference: CheckoutReferenceService,
    private readonly mercadoPago: MercadoPagoService,
    private readonly config: ConfigService,
  ) {}
```

- [ ] **Step 5: Add the redemption branch**

In `checkoutBooking`, insert this immediately after the existing `hasCredit` block and before `const user = await this.usersService.findById(customer.id);`:

```ts
    if (dto.discountCode) {
      const validCode = await this.discountCodesService.isCodeValid(dto.discountCode);
      if (!validCode) throw new BadRequestException('Código de descuento inválido.');
      const redeemed = await this.usersService.tryRedeemFreeSession(customer.id);
      if (!redeemed) throw new ConflictException('Ya usaste tu sesión gratis con código de descuento.');
      try {
        return await this.bookingsService.create(dto, customer.id);
      } catch (e) {
        // Igual que restoreCredit: si la reserva falla, la sesión gratis
        // queda disponible para reintentar con otro horario.
        await this.usersService.restoreFreeSession(customer.id);
        throw e;
      }
    }

```

- [ ] **Step 6: Register `DiscountCodesModule` in `PaymentsModule`**

In `server/src/payments/payments.module.ts`, add the import:

```ts
import { DiscountCodesModule } from '../discount-codes/discount-codes.module';
```

Add it to the `imports` array:

```ts
  imports: [TypeOrmModule.forFeature([CheckoutIntent]), BookingsModule, SubscriptionsModule, UsersModule, PricingModule, DiscountCodesModule],
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm test --workspace=server -- payments.controller.spec.ts`
Expected: PASS.

- [ ] **Step 8: Run the full backend test suite**

Run: `npm test --workspace=server`
Expected: PASS (no regressions in `checkout-reference.service.spec.ts`, `subscriptions.service.spec.ts`, etc.).

- [ ] **Step 9: Commit**

```bash
git add server/src/payments/dto/create-checkout.dto.ts server/src/payments/payments.controller.ts server/src/payments/payments.module.ts server/src/payments/payments.controller.spec.ts
git commit -m "feat: redeem discount code for a free session in checkoutBooking"
```

---

### Task 5: Frontend types, schema, and RTK Query slice

**Files:**
- Modify: `src/schemas/booking.schema.ts`
- Modify: `src/types/booking.types.ts`
- Create: `src/features/api/discountCodeApi.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `ClientFieldsValues`/`CreateBookingRequest` both gain `discountCode?: string` (Task 6 passes this through). `DiscountCodeSettings` type + `useGetAdminDiscountCodeQuery`/`useUpdateDiscountCodeMutation` (Task 8 uses these).

- [ ] **Step 1: Add `discountCode` to the client fields schema**

In `src/schemas/booking.schema.ts`:

```ts
export const clientFieldsSchema = z.object({
  notes: z.string().optional(),
  discountCode: z.string().optional(),
});
```

- [ ] **Step 2: Add `discountCode` to `CreateBookingRequest` and a new `DiscountCodeSettings` type**

In `src/types/booking.types.ts`, update `CreateBookingRequest`:

```ts
export interface CreateBookingRequest {
  date: string;
  time: string;
  service: string;
  notes?: string;
  discountCode?: string;
}
```

Add a new interface (near `PricingConfig`):

```ts
export interface DiscountCodeSettings {
  code: string;
  active: boolean;
}
```

- [ ] **Step 3: Create the admin discount-code RTK Query slice**

```ts
// src/features/api/discountCodeApi.ts
import type { DiscountCodeSettings } from '../../types/booking.types';
import { baseApi } from './baseApi';

export const discountCodeApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAdminDiscountCode: builder.query<DiscountCodeSettings, void>({
      query: () => ({ url: '/admin/discount-code', method: 'GET' }),
      providesTags: ['Config'],
    }),
    updateDiscountCode: builder.mutation<DiscountCodeSettings, DiscountCodeSettings>({
      query: (data) => ({ url: '/admin/discount-code', method: 'PUT', data }),
      invalidatesTags: ['Config'],
    }),
  }),
});

export const { useGetAdminDiscountCodeQuery, useUpdateDiscountCodeMutation } = discountCodeApi;
```

- [ ] **Step 4: Type-check**

Run: `npm run build`
Expected: build succeeds (no other file references these types yet, so nothing should break).

- [ ] **Step 5: Commit**

```bash
git add src/schemas/booking.schema.ts src/types/booking.types.ts src/features/api/discountCodeApi.ts
git commit -m "feat: add discountCode to booking types/schema and a discount-code admin API slice"
```

---

### Task 6: Read `?promo=` and add discount code redemption UI

**Files:**
- Modify: `src/hooks/useBookingFlow.ts`
- Modify: `src/components/booking/BookingSection/index.tsx`
- Modify: `src/components/booking/PaymentChoice/index.tsx`

**Interfaces:**
- Consumes: `discountCode?: string` on `ClientFieldsValues`/`CreateBookingRequest` (Task 5).
- Produces: none consumed by later tasks (Task 7 edits `PaymentChoice`/`AdminPricingPage` for an unrelated concern — socio messaging — and doesn't depend on this task's additions).

This task touches all three files together (rather than splitting the hook/section change from the component change) because `BookingSection` passing `initialDiscountCode`/`onRedeemFreeSession` to `PaymentChoice` and `PaymentChoice` accepting them are two halves of one type-check — splitting them would leave the build red between tasks.

- [ ] **Step 1: Read `?promo=` in `useBookingFlow`**

In `src/hooks/useBookingFlow.ts`, add the import:

```ts
import { useSearchParams } from 'react-router-dom';
```

Inside the hook body, near the other `useState` calls, add:

```ts
  const [searchParams] = useSearchParams();
  const initialDiscountCode = searchParams.get('promo');
```

Add `initialDiscountCode` to the returned object (after `isSocio`):

```ts
    isSocio: me?.isSocio ?? false,
    initialDiscountCode,
    isSubmitting,
```

- [ ] **Step 2: Thread it into `BookingSection`**

In `src/components/booking/BookingSection/index.tsx`, destructure `initialDiscountCode` from `useBookingFlow()`:

```ts
    isSocio,
    initialDiscountCode,
    isSubmitting,
    pricing,
  } = useBookingFlow();
```

Pass the new props to `PaymentChoice`:

```tsx
          <PaymentChoice
            isSocio={isSocio}
            hasActivePlan={hasActivePlan}
            isFirstSession={isFirstSession}
            pricing={pricing}
            initialDiscountCode={initialDiscountCode}
            onPayOneOff={(notes) => submitBooking({ notes })}
            onRedeemFreeSession={(code, notes) => submitBooking({ notes, discountCode: code })}
            onSubscribe={subscribeAndBook}
          />
```

- [ ] **Step 3: Add imports and props to `PaymentChoice`**

In `src/components/booking/PaymentChoice/index.tsx`, add imports:

```ts
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import type { CreateBookingResponse, PricingConfig } from '../../../types/booking.types';
```

(Replace the existing `import type { PricingConfig } from '../../../types/booking.types';` with the combined import above.)

Update the props interface:

```ts
interface PaymentChoiceProps {
  isSocio: boolean;
  hasActivePlan: boolean;
  isFirstSession: boolean;
  pricing: PricingConfig | undefined;
  initialDiscountCode?: string | null;
  onPayOneOff: (notes: string) => Promise<unknown>;
  onRedeemFreeSession: (code: string, notes: string) => Promise<CreateBookingResponse>;
  onSubscribe: (plan: 'standard' | 'premium', notes: string) => Promise<void>;
}
```

Update the component signature:

```ts
export const PaymentChoice = ({
  isSocio,
  hasActivePlan,
  isFirstSession,
  pricing,
  initialDiscountCode,
  onPayOneOff,
  onRedeemFreeSession,
  onSubscribe,
}: PaymentChoiceProps): JSX.Element => {
```

- [ ] **Step 4: Add discount-code state and the redemption handler**

Inside the component, after the existing `const [notes, setNotes] = useState('');`, add:

```ts
  const [discountCode, setDiscountCode] = useState(initialDiscountCode ?? '');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleRedeemCode = async () => {
    setIsLoading('discount');
    setError(null);
    setSuccessMessage(null);
    try {
      const result = await onRedeemFreeSession(discountCode, notes);
      setSuccessMessage(
        result.emailSent
          ? `✓ Reserva confirmada: ${result.date} a las ${result.time}. Te enviamos un mail con el protocolo y qué llevar. ¡Te esperamos!`
          : `✓ Reserva confirmada: ${result.date} a las ${result.time}. ¡Te esperamos! (No pudimos enviarte el mail con el protocolo; te escribimos por WhatsApp.)`,
      );
    } catch (err) {
      setError(extractApiErrorMessage(err));
    } finally {
      setIsLoading(null);
    }
  };
```

Update the `isLoading` state's type union to include `'discount'`:

```ts
  const [isLoading, setIsLoading] = useState<'oneoff' | 'standard' | 'premium' | 'discount' | null>(null);
```

- [ ] **Step 5: Render the input and button**

Immediately after the closing `</Textarea>`'s parent (i.e. right after the `<Textarea ... />` element) and before the "Pagar" `<Button>`, add:

```tsx
      {initialDiscountCode && (
        <div className="mb-3">
          <Label htmlFor="discount-code">Código de descuento</Label>
          <Input id="discount-code" value={discountCode} onChange={(e) => setDiscountCode(e.target.value)} />
          <Button
            type="button"
            variant="ghost"
            size="block"
            className="mt-2"
            disabled={isLoading !== null || !pricing || !discountCode}
            onClick={handleRedeemCode}
          >
            {isLoading === 'discount' ? 'Canjeando…' : 'Usar código (sesión gratis)'}
          </Button>
        </div>
      )}
```

At the end of the component, right after the existing `{error && <p ...>{error}</p>}` line, add:

```tsx
      {successMessage && <p className="mt-2 text-sm text-success">{successMessage}</p>}
```

- [ ] **Step 6: Type-check**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 7: Manual check in the browser**

Run: `npm run dev` (and `npm run dev:server` in another terminal)
Visit `http://localhost:5173/?promo=anything#reservar` (any value — the real code isn't configured until Task 8 is done and an admin sets one). Confirm the "Código de descuento" input and "Usar código" button appear only when `?promo=` is present, and that clicking it with no active code yet shows the inline error message (proves the button reaches the backend and the error path renders).

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useBookingFlow.ts src/components/booking/BookingSection/index.tsx src/components/booking/PaymentChoice/index.tsx
git commit -m "feat: read ?promo= discount code and add redemption UI to PaymentChoice"
```

---

### Task 7: Socio 50% messaging (bounded)

**Files:**
- Modify: `src/components/booking/PaymentChoice/index.tsx`
- Modify: `src/pages/AdminPricingPage/index.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing consumed by later tasks — purely presentational.

- [ ] **Step 1: Add the socio note in `PaymentChoice`**

In `src/components/booking/PaymentChoice/index.tsx`, right after the existing intro `<p className="mb-4 text-sm text-muted-foreground">...</p>` and before the `<Textarea .../>`, add:

```tsx
      {isSocio ? (
        <p className="mb-3 text-xs text-success">Precio socio aplicado (50% OFF).</p>
      ) : (
        <p className="mb-3 text-xs text-muted-foreground">Los socios de MOVE ahorran 50% en sesiones y planes.</p>
      )}
```

- [ ] **Step 2: Add the live discount-percent hint in `AdminPricingPage`**

In `src/pages/AdminPricingPage/index.tsx`, add the import:

```ts
import { useWatch } from 'react-hook-form';
import { cn } from '../../lib/cn';
```

Update the `useForm` destructure to also grab `control`:

```ts
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<PricingFormValues>({ resolver: zodResolver(pricingSchema) });
```

Add this helper above the returned JSX:

```ts
  const discountPercent = (regular: unknown, socio: unknown): number | null => {
    const r = Number(regular);
    const s = Number(socio);
    if (!r || !s) return null;
    return Math.round((1 - s / r) * 100);
  };

  const standardRegular = useWatch({ control, name: 'standardPriceUyu' });
  const standardSocio = useWatch({ control, name: 'standardPriceSocioUyu' });
  const premiumRegular = useWatch({ control, name: 'premiumPriceUyu' });
  const premiumSocio = useWatch({ control, name: 'premiumPriceSocioUyu' });
  const resetRegular = useWatch({ control, name: 'resetSessionPriceUyu' });
  const resetSocio = useWatch({ control, name: 'resetSessionPriceSocioUyu' });

  const renderDiscountHint = (regular: unknown, socio: unknown): JSX.Element | null => {
    const pct = discountPercent(regular, socio);
    if (pct === null) return null;
    return <span className={cn('ml-2 text-xs', pct >= 45 && pct <= 55 ? 'text-success' : 'text-destructive')}>−{pct}%</span>;
  };
```

Update each socio `<Label>` to include the hint (three places — standard, premium, reset session):

```tsx
              <div>
                <Label htmlFor="standardPriceSocioUyu">
                  Precio socio
                  {renderDiscountHint(standardRegular, standardSocio)}
                </Label>
                <Input id="standardPriceSocioUyu" type="number" {...register('standardPriceSocioUyu')} />
                {errors.standardPriceSocioUyu && <p className="mt-1 text-xs text-destructive">{errors.standardPriceSocioUyu.message}</p>}
              </div>
```

```tsx
              <div>
                <Label htmlFor="premiumPriceSocioUyu">
                  Precio socio
                  {renderDiscountHint(premiumRegular, premiumSocio)}
                </Label>
                <Input id="premiumPriceSocioUyu" type="number" {...register('premiumPriceSocioUyu')} />
                {errors.premiumPriceSocioUyu && <p className="mt-1 text-xs text-destructive">{errors.premiumPriceSocioUyu.message}</p>}
              </div>
```

```tsx
              <div>
                <Label htmlFor="resetSessionPriceSocioUyu">
                  Precio socio
                  {renderDiscountHint(resetRegular, resetSocio)}
                </Label>
                <Input id="resetSessionPriceSocioUyu" type="number" {...register('resetSessionPriceSocioUyu')} />
                {errors.resetSessionPriceSocioUyu && (
                  <p className="mt-1 text-xs text-destructive">{errors.resetSessionPriceSocioUyu.message}</p>
                )}
              </div>
```

- [ ] **Step 3: Type-check**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual check in the browser**

Run: `npm run dev` + `npm run dev:server`, log in as admin, open `/admin/precios`. Confirm each socio price field shows a live `−NN%` hint that updates as you type, colored green near 50% and red if you deliberately type something far off (e.g. 10%). Then open the public booking flow as a socio user and confirm the "Precio socio aplicado (50% OFF)" note appears; as a non-socio, confirm the "ahorran 50%" note appears instead.

- [ ] **Step 5: Commit**

```bash
git add src/components/booking/PaymentChoice/index.tsx src/pages/AdminPricingPage/index.tsx
git commit -m "content: surface socio 50% discount messaging in booking and admin pricing"
```

---

### Task 8: Admin UI to manage the global discount code

**Files:**
- Modify: `src/pages/AdminPricingPage/index.tsx`

**Interfaces:**
- Consumes: `useGetAdminDiscountCodeQuery`/`useUpdateDiscountCodeMutation` (Task 5).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Add imports and state**

In `src/pages/AdminPricingPage/index.tsx`, add imports:

```ts
import { Checkbox } from '../../components/ui/checkbox';
import { useGetAdminDiscountCodeQuery, useUpdateDiscountCodeMutation } from '../../features/api/discountCodeApi';
```

Inside the component, alongside the existing pricing query/mutation hooks, add:

```ts
  const { data: discountCode, isFetching: isFetchingCode, refetch: refetchCode } = useGetAdminDiscountCodeQuery();
  const [updateDiscountCode, { isLoading: isSavingCode }] = useUpdateDiscountCodeMutation();
  const [codeValue, setCodeValue] = useState('');
  const [codeActive, setCodeActive] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeSaved, setCodeSaved] = useState(false);

  useEffect(() => {
    if (discountCode) {
      setCodeValue(discountCode.code);
      setCodeActive(discountCode.active);
    }
  }, [discountCode]);

  const submitDiscountCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setCodeError(null);
    setCodeSaved(false);
    try {
      await updateDiscountCode({ code: codeValue, active: codeActive }).unwrap();
      setCodeSaved(true);
    } catch (err) {
      setCodeError(extractApiErrorMessage(err));
    }
  };
```

- [ ] **Step 2: Combine the reload button with both queries**

Update the `<AdminTopNav>` call:

```tsx
      <AdminTopNav onReload={() => { refetch(); refetchCode(); }} isReloading={isFetching || isFetchingCode} />
```

- [ ] **Step 3: Render the new section**

Add this new `<form>` right after the closing `</form>` of the existing pricing form, still inside `<main>`:

```tsx
        <form onSubmit={submitDiscountCode} className="max-w-xl space-y-4 rounded-lg border border-border bg-card p-7">
          <h2 className="text-xs uppercase tracking-wide text-muted-foreground">Código de descuento (sesión gratis)</h2>
          <div>
            <Label htmlFor="discount-code-value">Código</Label>
            <Input id="discount-code-value" value={codeValue} onChange={(e) => setCodeValue(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="discount-code-active" checked={codeActive} onCheckedChange={(checked) => setCodeActive(checked === true)} />
            <Label htmlFor="discount-code-active">Activo</Label>
          </div>
          <Button type="submit" disabled={isSavingCode || isFetchingCode}>
            {isSavingCode ? 'Guardando…' : 'Guardar código'}
          </Button>
          {codeSaved && <p className="text-sm text-success">Código actualizado.</p>}
          {codeError && <p className="text-sm text-destructive">{codeError}</p>}
        </form>
```

- [ ] **Step 4: Type-check**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Manual check in the browser**

Run: `npm run dev` + `npm run dev:server`, log in as admin, open `/admin/precios`. Set a code (e.g. `BIENVENIDO`), check "Activo", save, confirm "Código actualizado." appears and reloading the page keeps the saved value.

- [ ] **Step 6: Commit**

```bash
git add src/pages/AdminPricingPage/index.tsx
git commit -m "feat: add admin UI to manage the global discount code"
```

---

### Task 9: End-to-end manual verification

**Files:** none (verification only).

- [ ] **Step 1: Run the migrations against a real dev database**

Run: `npm run migration:run --workspace=server` (requires `DATABASE_URL` in `.env` pointing at a disposable dev DB, per this project's convention — never a production one).

- [ ] **Step 2: Configure a code as admin**

Start both servers (`npm run dev:server`, `npm run dev`), log into `/admin`, open `/admin/precios`, set a code (e.g. `PRUEBA2026`) and check "Activo", save.

- [ ] **Step 3: Redeem it as a customer**

In an incognito window, sign in with Google, open `http://localhost:5173/?promo=PRUEBA2026#reservar`, pick a date/time, and confirm the "Código de descuento" input is pre-filled with `PRUEBA2026`. Click "Usar código (sesión gratis)" and confirm a booking is created with a success message and no redirect to MercadoPago.

- [ ] **Step 4: Confirm the one-per-user limit**

As the same customer, try to redeem the code again (same or a different valid code) — confirm it's rejected with "Ya usaste tu sesión gratis con código de descuento."

- [ ] **Step 5: Confirm an invalid code is rejected**

As a different (or the same) customer, try a code that doesn't match — confirm "Código de descuento inválido." appears inline, and that the normal "Pagar $X" flow still works unaffected on the same page.

- [ ] **Step 6: Confirm socio messaging**

Toggle a test user's socio flag on/off from `/admin/usuarios` and confirm the "Precio socio aplicado (50% OFF)" / "Los socios de MOVE ahorran 50%" messaging in the booking flow switches accordingly.

- [ ] **Step 7: Note results**

If any step can't be verified in this environment (e.g. no reachable `DATABASE_URL`, no MercadoPago sandbox credentials), record exactly which steps were skipped and why when handing off, rather than reporting the feature as fully verified.
