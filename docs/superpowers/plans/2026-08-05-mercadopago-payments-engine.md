# MercadoPago payments engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let customers pay for a single Reset Session or subscribe to Standard/Premium Reset via MercadoPago, track monthly session credits, and skip payment entirely at booking time once a customer has an active plan — completing the plans/payments spec (the admin socio-toggle half already shipped separately).

**Architecture:** MercadoPago Checkout Pro (hosted redirect) for both payment types. A signed, tamper-proof `external_reference` carries the booking intent through the redirect; a signature-verified webhook is the only place that ever creates a paid booking or activates a subscription — the frontend's own redirect return is never trusted for anything security-relevant, only used to kick off polling.

**Tech Stack:** NestJS + TypeORM (existing), raw `fetch()` against MercadoPago's REST API — no MercadoPago SDK dependency, matching this codebase's existing pattern for third-party APIs (`MailService`'s raw-fetch Brevo integration, not an SDK). React + RTK Query (existing).

## Global Constraints

- Plans/prices (code constants, not DB-driven, matching `SLOTS`/`SERVICIOS`): Standard Reset $2400/mo (4 sessions, $1200 socio), Premium Reset $3840/mo (8 sessions, $1920 socio), Reset Session $600 one-off (1 session, $300 socio). Credits reset to the plan total each cycle — no rollover.
- A customer's **current subscription** is always resolved as: the most recent `Subscription` row (`ORDER BY created_at DESC`) whose `currentPeriodEnd >= today`. Cancelling a subscription calls MercadoPago's cancel API immediately and marks the local row `status: 'cancelled'`, but does **not** touch `currentPeriodEnd`/`sessionCreditsRemaining` — the customer keeps using the period they already paid for; this resolution rule is what makes "active until period end" work with no cron job.
- No booking is ever created directly from a checkout-creation request — only from a signature-verified webhook (for the payment-required paths) or directly (for the credit-covered path, which needs no payment at all).
- `external_reference` payloads are signed (HMAC) with a dedicated secret (`CHECKOUT_REFERENCE_SECRET`, separate from `JWT_SECRET`/`USER_JWT_SECRET` — same one-secret-per-purpose reasoning already used in this codebase) so a customer can't tamper with the redirect to get a cheaper session or someone else's slot.
- Webhook calls are rejected unless their MercadoPago signature validates against `MP_WEBHOOK_SECRET`.
- Slot race handling: one-off payment confirmed but slot taken → refund via MercadoPago, no booking created. Subscription confirmed but originally-intended slot taken → subscription still stands, booking simply isn't auto-created (customer picks again with their new credit; no refund needed since the subscription payment wasn't tied to that specific slot).
- No automated tests for framework wiring/controllers/webhook orchestration (verified via curl + a final live pass against a MercadoPago sandbox account) — automated unit tests only for the two pieces of genuinely branching pure logic: the checkout-reference sign/verify round-trip, the webhook signature verification, and the subscription credit-check/resolution logic. This matches this project's established testing convention.
- **Real MercadoPago sandbox credentials are required for the final end-to-end task** (`MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`) — these come from the user's own MercadoPago developer account, the same way the Google OAuth Client ID did in the previous phase. Every task before that uses curl/unit-test verification that doesn't require a live payment to actually succeed.

---

## File Structure

**Backend:**
```
server/src/catalog/catalog.constants.ts                     (modify: add PLANS)
server/src/subscriptions/entities/subscription.entity.ts    (new)
server/src/migrations/<ts>-CreateSubscriptions.ts            (new)
server/src/migrations/<ts>-AddMpPaymentIdToBookings.ts        (new)
server/src/bookings/entities/booking.entity.ts               (modify: add mpPaymentId)
server/src/bookings/bookings.service.ts                      (modify: create() takes optional mpPaymentId)
server/src/bookings/bookings.controller.ts                   (modify: remove the old public-facing POST)
server/src/bookings/bookings.module.ts                       (modify: export BookingsService)
server/src/payments/checkout-reference.service.ts             (new)
server/src/payments/checkout-reference.service.spec.ts        (new, TDD)
server/src/payments/webhook-signature.util.ts                 (new)
server/src/payments/webhook-signature.util.spec.ts             (new, TDD)
server/src/payments/mercadopago.service.ts                     (new)
server/src/payments/payments.controller.ts                     (new)
server/src/payments/payments.module.ts                         (new)
server/src/payments/dto/*.ts                                    (new, several small DTOs)
server/src/subscriptions/subscriptions.service.ts               (new)
server/src/subscriptions/subscriptions.service.spec.ts           (new, TDD)
server/src/subscriptions/subscriptions.controller.ts             (new)
server/src/subscriptions/subscriptions.module.ts                 (new)
server/src/diag/diag.service.ts                                  (modify: report new env vars)
.env.example                                                     (modify)
DEPLOY.md                                                        (modify)
```

**Frontend:**
```
src/schemas/... (no schema changes needed — booking form itself is unchanged)
src/types/subscription.types.ts                                  (new)
src/features/api/userApi.ts                                      (modify: add checkout/subscription endpoints)
src/hooks/useBookingFlow.ts                                       (modify: check credits, branch to checkout)
src/components/booking/BookingSection/index.tsx                  (modify: show pay/subscribe choice)
src/components/booking/PaymentChoice/index.tsx                    (new)
src/pages/CheckoutPendingPage/index.tsx                           (new)
src/routes/router.tsx                                             (modify: add /pago-pendiente)
src/pages/MiCuentaPage/index.tsx                                  (modify: real plan data + cancel button)
src/components/account/CancelSubscriptionDialog/index.tsx         (new)
```

**Module dependency direction (no cycles):** `PaymentsModule` imports `BookingsModule` (for `BookingsService`, now exported), `SubscriptionsModule` (for `SubscriptionsService`), and `UsersModule` (for `UsersService`/`User` lookups — pricing needs `isSocio`). `SubscriptionsModule` registers `TypeOrmModule.forFeature([Subscription, User])` directly (matching `BookingsModule`'s existing precedent) rather than importing `UsersModule`, so it has zero module-level dependencies of its own. Nothing imports `PaymentsModule` back. `BookingsModule`/`SubscriptionsModule`/`UsersModule` are unaware `PaymentsModule` exists.

---

## Task 1: Plan catalog constants

**Files:**
- Modify: `server/src/catalog/catalog.constants.ts`

**Interfaces:**
- Produces: `PLANS` constant, `PlanKey` type. Used by every later backend task that needs pricing/session counts.

- [ ] **Step 1: Add the constant**

At the end of `server/src/catalog/catalog.constants.ts` (leave `SLOTS`/`SERVICIOS`/existing types untouched), add:

```ts
export const PLANS = {
  standard: { label: 'Standard Reset', priceUyu: 2400, priceSocioUyu: 1200, sessionsPerMonth: 4 },
  premium: { label: 'Premium Reset', priceUyu: 3840, priceSocioUyu: 1920, sessionsPerMonth: 8 },
} as const;

export type PlanKey = keyof typeof PLANS;

export const RESET_SESSION_PRICE = { priceUyu: 600, priceSocioUyu: 300 } as const;
```

- [ ] **Step 2: Verify**

Run `npm run build --workspace=server` from the repo root — expect success (this is a pure addition, nothing consumes it yet).

- [ ] **Step 3: Commit**

```bash
git add server/src/catalog/catalog.constants.ts
git commit -m "feat(server): add plan pricing constants"
```

---

## Task 2: Subscription entity + migration

**Files:**
- Create: `server/src/subscriptions/entities/subscription.entity.ts`
- Create: `server/src/migrations/1785894600000-CreateSubscriptions.ts`

**Interfaces:**
- Produces: `Subscription` entity. Used by every later Subscriptions/Payments task.

- [ ] **Step 1: Write the entity**

```ts
// server/src/subscriptions/entities/subscription.entity.ts
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'text' })
  plan: 'standard' | 'premium';

  @Column({ name: 'mp_preapproval_id', type: 'text', unique: true })
  mpPreapprovalId: string;

  // Estado de facturación en MercadoPago — NO es el chequeo de acceso (ver
  // SubscriptionsService.hasUsableCredits): una suscripción 'cancelled' sigue
  // siendo válida hasta currentPeriodEnd, a propósito.
  @Column({ type: 'text' })
  status: 'authorized' | 'cancelled';

  // TEXT a propósito, igual que Booking.date/time — se comparan como strings
  // AAAA-MM-DD, evita la ambigüedad de zona horaria de los tipos date/timestamp
  // nativos de Postgres.
  @Column({ name: 'current_period_start', type: 'text' })
  currentPeriodStart: string;

  @Column({ name: 'current_period_end', type: 'text' })
  currentPeriodEnd: string;

  @Column({ name: 'session_credits_remaining', type: 'int' })
  sessionCreditsRemaining: number;

  @Column({ name: 'session_credits_total', type: 'int' })
  sessionCreditsTotal: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
```

- [ ] **Step 2: Write the migration**

```ts
// server/src/migrations/1785894600000-CreateSubscriptions.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSubscriptions1785894600000 implements MigrationInterface {
  name = 'CreateSubscriptions1785894600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "subscriptions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "plan" text NOT NULL,
        "mp_preapproval_id" text NOT NULL,
        "status" text NOT NULL,
        "current_period_start" text NOT NULL,
        "current_period_end" text NOT NULL,
        "session_credits_remaining" integer NOT NULL,
        "session_credits_total" integer NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_subscriptions_mp_preapproval_id" UNIQUE ("mp_preapproval_id"),
        CONSTRAINT "PK_subscriptions_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_subscriptions_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id")
      )
    `);
    // Acelera la resolución de "suscripción actual" (ORDER BY created_at DESC
    // filtrando por user_id y current_period_end).
    await queryRunner.query(`
      CREATE INDEX "IDX_subscriptions_user_id_created_at" ON "subscriptions" ("user_id", "created_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_subscriptions_user_id_created_at"`);
    await queryRunner.query(`DROP TABLE "subscriptions"`);
  }
}
```

- [ ] **Step 3: Register the entity**

In `server/src/app.module.ts`, add the import and include it in `entities`:
```ts
import { Subscription } from './subscriptions/entities/subscription.entity';
// ...
entities: [AdminUser, Booking, User, Subscription],
```
Do the same in `server/src/data-source.ts`'s `entities` array.

- [ ] **Step 4: Run the migration**

Run: `npm run migration:run --workspace=server`
Expected: `Migration CreateSubscriptions1785894600000 has been executed successfully.`

- [ ] **Step 5: Commit**

```bash
git add server/src/subscriptions/entities/subscription.entity.ts server/src/migrations/1785894600000-CreateSubscriptions.ts server/src/app.module.ts server/src/data-source.ts
git commit -m "feat(server): add Subscription entity and migration"
```

---

## Task 3: Booking gains `mpPaymentId`; `BookingsService.create` accepts it

**Files:**
- Modify: `server/src/bookings/entities/booking.entity.ts`
- Create: `server/src/migrations/1785894600001-AddMpPaymentIdToBookings.ts`
- Modify: `server/src/bookings/bookings.service.ts`
- Modify: `server/src/bookings/bookings.module.ts`

**Interfaces:**
- Produces: `BookingsService.create(dto, userId, mpPaymentId?)` — the third parameter is new and optional, existing callers are unaffected. `BookingsModule` now exports `BookingsService` for `PaymentsModule` to consume later.

- [ ] **Step 1: Add the column**

In `server/src/bookings/entities/booking.entity.ts`, add one column (alongside the existing `userId`/`user` fields):
```ts
@Column({ name: 'mp_payment_id', type: 'text', nullable: true })
mpPaymentId: string | null;
```

- [ ] **Step 2: Write the migration**

```ts
// server/src/migrations/1785894600001-AddMpPaymentIdToBookings.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMpPaymentIdToBookings1785894600001 implements MigrationInterface {
  name = 'AddMpPaymentIdToBookings1785894600001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bookings" ADD COLUMN "mp_payment_id" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN "mp_payment_id"`);
  }
}
```

- [ ] **Step 3: Update `BookingsService.create`**

In `server/src/bookings/bookings.service.ts`, change the `create` method's signature and the object passed to `bookingsRepo.create`:

```ts
async create(dto: CreateBookingDto, userId: string, mpPaymentId: string | null = null): Promise<CreateBookingResponse> {
  if (dto.date < todayStr()) throw new BadRequestException('No se puede reservar en una fecha pasada.');

  const user = await this.usersRepo.findOneOrFail({ where: { id: userId } });
  if (user.phone === null) throw new BadRequestException('Completá tu perfil antes de reservar.');

  const service = (SERVICIOS as readonly string[]).includes(dto.service ?? '') ? (dto.service as string) : 'Recovery Room';

  let booking: Booking;
  try {
    booking = await this.bookingsRepo.save(
      this.bookingsRepo.create({
        date: dto.date,
        time: dto.time,
        name: user.name,
        email: user.email,
        phone: user.phone,
        service,
        notes: dto.notes || null,
        userId: user.id,
        mpPaymentId,
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

(Only the signature and the object literal inside `bookingsRepo.create` change — every other line of this method, and the rest of the file, stays exactly as it is.)

- [ ] **Step 4: Export `BookingsService` and register the new controller import used by the customer-guarded route removal (Task 14)**

In `server/src/bookings/bookings.module.ts`, add an `exports` array:
```ts
@Module({
  imports: [TypeOrmModule.forFeature([Booking, User]), MailModule, AuthModule, UsersModule],
  controllers: [BookingsController, AvailabilityController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
```

- [ ] **Step 5: Run the migration and verify**

Run: `npm run migration:run --workspace=server`
Expected: `Migration AddMpPaymentIdToBookings1785894600001 has been executed successfully.`

Run: `npm run build --workspace=server` — expect success. Run: `npm test --workspace=server` — expect the existing 9 tests to still pass (this task doesn't touch tested code paths).

- [ ] **Step 6: Commit**

```bash
git add server/src/bookings/entities/booking.entity.ts server/src/migrations/1785894600001-AddMpPaymentIdToBookings.ts server/src/bookings/bookings.service.ts server/src/bookings/bookings.module.ts
git commit -m "feat(server): bookings can record which MercadoPago payment covered them"
```

---

## Task 4: Checkout-reference signing (TDD)

**Files:**
- Create: `server/src/payments/checkout-reference.service.ts`
- Test: `server/src/payments/checkout-reference.service.spec.ts`

**Interfaces:**
- Produces: `CheckoutIntent` type (`OneOffBookingIntent | SubscriptionIntent`), `CheckoutReferenceService.sign(intent): string`, `.verify(reference): CheckoutIntent | null`. Used by Task 9 (checkout creation) and Tasks 11-12 (webhook handling).

- [ ] **Step 1: Write the failing tests**

```ts
// server/src/payments/checkout-reference.service.spec.ts
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
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test --workspace=server -- checkout-reference`
Expected: FAIL — `Cannot find module './checkout-reference.service'`

- [ ] **Step 3: Write the implementation**

```ts
// server/src/payments/checkout-reference.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

export interface OneOffBookingIntent {
  kind: 'oneoff';
  userId: string;
  date: string;
  time: string;
  service?: string;
  notes?: string;
}

export interface SubscriptionIntent {
  kind: 'subscription';
  userId: string;
  plan: 'standard' | 'premium';
  intendedBooking?: { date: string; time: string; service?: string; notes?: string };
}

export type CheckoutIntent = OneOffBookingIntent | SubscriptionIntent;

@Injectable()
export class CheckoutReferenceService {
  constructor(private readonly config: ConfigService) {}

  private get secret(): string {
    const s = this.config.get<string>('CHECKOUT_REFERENCE_SECRET');
    if (!s) throw new Error('Falta CHECKOUT_REFERENCE_SECRET.');
    return s;
  }

  sign(intent: CheckoutIntent): string {
    const payload = Buffer.from(JSON.stringify(intent)).toString('base64url');
    const signature = createHmac('sha256', this.secret).update(payload).digest('hex');
    return `${payload}.${signature}`;
  }

  verify(reference: string): CheckoutIntent | null {
    const [payload, signature] = reference.split('.');
    if (!payload || !signature) return null;

    const expected = createHmac('sha256', this.secret).update(payload).digest('hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    const actualBuf = Buffer.from(signature, 'hex');
    if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) return null;

    try {
      return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as CheckoutIntent;
    } catch {
      return null;
    }
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test --workspace=server -- checkout-reference`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add server/src/payments/checkout-reference.service.ts server/src/payments/checkout-reference.service.spec.ts
git commit -m "feat(server): signed checkout-intent references"
```

---

## Task 5: MercadoPago webhook signature verification (TDD)

**Files:**
- Create: `server/src/payments/webhook-signature.util.ts`
- Test: `server/src/payments/webhook-signature.util.spec.ts`

**Interfaces:**
- Produces: `verifyWebhookSignature(input): boolean`. Used by Task 11-12 (webhook handling).

- [ ] **Step 1: Write the failing tests**

```ts
// server/src/payments/webhook-signature.util.spec.ts
import { createHmac } from 'crypto';
import { verifyWebhookSignature } from './webhook-signature.util';

describe('verifyWebhookSignature', () => {
  const secret = 'test-webhook-secret';
  const dataId = '123456789';
  const xRequestId = 'req-abc-123';
  const ts = '1704908010';

  const validXSignature = () => {
    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
    const v1 = createHmac('sha256', secret).update(manifest).digest('hex');
    return `ts=${ts},v1=${v1}`;
  };

  it('accepts a correctly-signed webhook', () => {
    const result = verifyWebhookSignature({ xSignature: validXSignature(), xRequestId, dataId, secret });
    expect(result).toBe(true);
  });

  it('rejects a signature computed with the wrong secret', () => {
    const result = verifyWebhookSignature({ xSignature: validXSignature(), xRequestId, dataId, secret: 'wrong-secret' });
    expect(result).toBe(false);
  });

  it('rejects a signature for a different data id (tampered notification)', () => {
    const result = verifyWebhookSignature({ xSignature: validXSignature(), xRequestId, dataId: '999999999', secret });
    expect(result).toBe(false);
  });

  it('rejects a malformed x-signature header', () => {
    const result = verifyWebhookSignature({ xSignature: 'not-a-valid-header', xRequestId, dataId, secret });
    expect(result).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test --workspace=server -- webhook-signature`
Expected: FAIL — `Cannot find module './webhook-signature.util'`

- [ ] **Step 3: Write the implementation**

```ts
// server/src/payments/webhook-signature.util.ts
import { createHmac, timingSafeEqual } from 'crypto';

export interface WebhookSignatureInput {
  xSignature: string;
  xRequestId: string;
  dataId: string;
  secret: string;
}

// Algoritmo documentado por MercadoPago para validar notificaciones webhook:
// el header x-signature trae "ts=<timestamp>,v1=<hmac>"; el manifest a firmar
// es "id:<data.id>;request-id:<x-request-id>;ts:<ts>;" (data.id en minúsculas).
export function verifyWebhookSignature({ xSignature, xRequestId, dataId, secret }: WebhookSignatureInput): boolean {
  const parts: Record<string, string> = {};
  for (const part of xSignature.split(',')) {
    const [key, value] = part.split('=');
    if (key && value) parts[key.trim()] = value.trim();
  }

  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const manifest = `id:${dataId.toLowerCase()};request-id:${xRequestId};ts:${ts};`;
  const expected = createHmac('sha256', secret).update(manifest).digest('hex');

  const expectedBuf = Buffer.from(expected, 'hex');
  const actualBuf = Buffer.from(v1, 'hex');
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test --workspace=server -- webhook-signature`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add server/src/payments/webhook-signature.util.ts server/src/payments/webhook-signature.util.spec.ts
git commit -m "feat(server): verify MercadoPago webhook signatures"
```

---

## Task 6: MercadoPago API client

**Files:**
- Create: `server/src/payments/mercadopago.service.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `MercadoPagoService` with `createPreference`, `createPreapproval`, `getPayment`, `refundPayment`, `cancelPreapproval`. Used by Task 9-12.

- [ ] **Step 1: Write the service**

```ts
// server/src/payments/mercadopago.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const API_URL = 'https://api.mercadopago.com';

export interface CreatePreferenceParams {
  title: string;
  amount: number;
  externalReference: string;
  successUrl: string;
  failureUrl: string;
  pendingUrl: string;
}

export interface CreatePreapprovalParams {
  reason: string;
  amount: number;
  payerEmail: string;
  externalReference: string;
  backUrl: string;
}

export interface MpPayment {
  id: number;
  status: string;
  externalReference: string | null;
}

@Injectable()
export class MercadoPagoService {
  constructor(private readonly config: ConfigService) {}

  private get accessToken(): string {
    const token = this.config.get<string>('MP_ACCESS_TOKEN');
    if (!token) throw new Error('Falta MP_ACCESS_TOKEN.');
    return token;
  }

  private async request(path: string, init: RequestInit): Promise<Record<string, unknown>> {
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${this.accessToken}`, 'content-type': 'application/json' },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`MercadoPago ${res.status}: ${body.slice(0, 300)}`);
    }
    return res.json();
  }

  async createPreference(params: CreatePreferenceParams): Promise<{ initPoint: string }> {
    const data = await this.request('/checkout/preferences', {
      method: 'POST',
      body: JSON.stringify({
        items: [{ title: params.title, quantity: 1, unit_price: params.amount, currency_id: 'UYU' }],
        external_reference: params.externalReference,
        back_urls: { success: params.successUrl, failure: params.failureUrl, pending: params.pendingUrl },
        auto_return: 'approved',
      }),
    });
    return { initPoint: data.init_point as string };
  }

  async createPreapproval(params: CreatePreapprovalParams): Promise<{ initPoint: string; preapprovalId: string }> {
    const data = await this.request('/preapproval', {
      method: 'POST',
      body: JSON.stringify({
        reason: params.reason,
        external_reference: params.externalReference,
        payer_email: params.payerEmail,
        auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: params.amount, currency_id: 'UYU' },
        back_url: params.backUrl,
      }),
    });
    return { initPoint: data.init_point as string, preapprovalId: data.id as string };
  }

  async getPayment(paymentId: string): Promise<MpPayment> {
    const data = await this.request(`/v1/payments/${paymentId}`, { method: 'GET' });
    return {
      id: data.id as number,
      status: data.status as string,
      externalReference: (data.external_reference as string | undefined) ?? null,
    };
  }

  async refundPayment(paymentId: string): Promise<void> {
    await this.request(`/v1/payments/${paymentId}/refunds`, { method: 'POST' });
  }

  async cancelPreapproval(preapprovalId: string): Promise<void> {
    await this.request(`/preapproval/${preapprovalId}`, { method: 'PUT', body: JSON.stringify({ status: 'cancelled' }) });
  }
}
```

- [ ] **Step 2: Add env vars**

In `.env.example` (repo root), add:
```
# MercadoPago — Access Token de tu cuenta (Test o Producción) en
# https://www.mercadopago.com.uy/developers/panel/app
MP_ACCESS_TOKEN=

# Secreto de firma de webhooks — Tu app en el panel de MercadoPago →
# Webhooks → "Firma secreta" (se genera al configurar la URL de notificación).
MP_WEBHOOK_SECRET=

# Secreto propio para firmar el external_reference que viaja por MercadoPago
# (separado de JWT_SECRET/USER_JWT_SECRET a propósito, mismo criterio que los
# otros dos: un secreto por propósito).
CHECKOUT_REFERENCE_SECRET=
```

Add the same three to your local `.env` (any non-empty string for `MP_ACCESS_TOKEN`/`MP_WEBHOOK_SECRET` unblocks the app from crashing on missing config for now — real values arrive at the final live-verification task).

- [ ] **Step 3: Verify**

Run `npm run build --workspace=server` — expect success (nothing calls this service yet, so no runtime check possible until later tasks).

- [ ] **Step 4: Commit**

```bash
git add server/src/payments/mercadopago.service.ts .env.example
git commit -m "feat(server): MercadoPago API client"
```

---

## Task 7: Subscription resolution + credit logic (TDD)

**Files:**
- Create: `server/src/subscriptions/subscriptions.service.ts`
- Test: `server/src/subscriptions/subscriptions.service.spec.ts`

**Interfaces:**
- Consumes: `Subscription` entity (Task 2), `PLANS` (Task 1).
- Produces: `SubscriptionsService` with `findCurrent(userId)`, `tryConsumeCredit(userId)`, `createFromPreapproval(...)`, `cancel(userId, mpService)`. Used by Task 8 (controller) and Task 9-12 (payments orchestration).

- [ ] **Step 1: Write the failing tests**

```ts
// server/src/subscriptions/subscriptions.service.spec.ts
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
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test --workspace=server -- subscriptions.service`
Expected: FAIL — `Cannot find module './subscriptions.service'`

- [ ] **Step 3: Write the implementation**

```ts
// server/src/subscriptions/subscriptions.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { PLANS, PlanKey } from '../catalog/catalog.constants';
import { todayStr } from '../common/date.util';
import { Subscription } from './entities/subscription.entity';

export interface CreateFromPreapprovalParams {
  userId: string;
  plan: PlanKey;
  mpPreapprovalId: string;
  periodStart: string;
  periodEnd: string;
}

@Injectable()
export class SubscriptionsService {
  constructor(@InjectRepository(Subscription) private readonly subscriptionsRepo: Repository<Subscription>) {}

  findCurrent(userId: string): Promise<Subscription | null> {
    return this.subscriptionsRepo.findOne({
      where: { userId, currentPeriodEnd: MoreThanOrEqual(todayStr()) },
      order: { createdAt: 'DESC' },
    });
  }

  async tryConsumeCredit(userId: string): Promise<boolean> {
    const subscription = await this.findCurrent(userId);
    if (!subscription || subscription.sessionCreditsRemaining <= 0) return false;
    subscription.sessionCreditsRemaining -= 1;
    await this.subscriptionsRepo.save(subscription);
    return true;
  }

  async createFromPreapproval(params: CreateFromPreapprovalParams): Promise<Subscription> {
    const total = PLANS[params.plan].sessionsPerMonth;
    return this.subscriptionsRepo.save(
      this.subscriptionsRepo.create({
        userId: params.userId,
        plan: params.plan,
        mpPreapprovalId: params.mpPreapprovalId,
        status: 'authorized',
        currentPeriodStart: params.periodStart,
        currentPeriodEnd: params.periodEnd,
        sessionCreditsTotal: total,
        sessionCreditsRemaining: total,
      }),
    );
  }

  // Se llama cuando llega el webhook de un cobro recurrente (renovación).
  async renewPeriod(mpPreapprovalId: string, periodStart: string, periodEnd: string): Promise<Subscription | null> {
    const subscription = await this.subscriptionsRepo.findOne({ where: { mpPreapprovalId }, order: { createdAt: 'DESC' } });
    if (!subscription) return null;
    subscription.currentPeriodStart = periodStart;
    subscription.currentPeriodEnd = periodEnd;
    subscription.sessionCreditsRemaining = subscription.sessionCreditsTotal;
    return this.subscriptionsRepo.save(subscription);
  }

  async markCancelled(userId: string): Promise<Subscription | null> {
    const subscription = await this.findCurrent(userId);
    if (!subscription) return null;
    subscription.status = 'cancelled';
    return this.subscriptionsRepo.save(subscription);
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test --workspace=server -- subscriptions.service`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add server/src/subscriptions/subscriptions.service.ts server/src/subscriptions/subscriptions.service.spec.ts
git commit -m "feat(server): subscription resolution and credit-consumption logic"
```

---

## Task 8: Subscriptions module + customer-facing endpoints

**Files:**
- Create: `server/src/subscriptions/subscriptions.controller.ts`
- Create: `server/src/subscriptions/subscriptions.module.ts`
- Modify: `server/src/app.module.ts`

**Interfaces:**
- Consumes: `SubscriptionsService` (Task 7), customer `UserJwtAuthGuard`/`CurrentUser` (existing).
- Produces: `GET /api/subscriptions/me`, `DELETE /api/subscriptions/me`. Used by the frontend (Task 19) and by Task 9's credit check indirectly (same service, different consumer).

- [ ] **Step 1: Write the controller**

```ts
// server/src/subscriptions/subscriptions.controller.ts
import { Controller, Delete, Get, NotFoundException, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../users/decorators/current-user.decorator';
import { UserJwtAuthGuard } from '../users/guards/user-jwt-auth.guard';
import { AuthenticatedCustomer } from '../users/users.types';
import { MercadoPagoService } from '../payments/mercadopago.service';
import { SubscriptionsService } from './subscriptions.service';

@Controller('subscriptions')
@UseGuards(UserJwtAuthGuard)
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly mercadoPago: MercadoPagoService,
  ) {}

  @Get('me')
  async me(@CurrentUser() customer: AuthenticatedCustomer) {
    const subscription = await this.subscriptionsService.findCurrent(customer.id);
    if (!subscription) return null;
    return {
      plan: subscription.plan,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
      sessionCreditsRemaining: subscription.sessionCreditsRemaining,
      sessionCreditsTotal: subscription.sessionCreditsTotal,
    };
  }

  @Delete('me')
  async cancel(@CurrentUser() customer: AuthenticatedCustomer) {
    const subscription = await this.subscriptionsService.findCurrent(customer.id);
    if (!subscription) throw new NotFoundException('No tenés una suscripción activa.');
    await this.mercadoPago.cancelPreapproval(subscription.mpPreapprovalId);
    await this.subscriptionsService.markCancelled(customer.id);
    return { ok: true };
  }
}
```

- [ ] **Step 2: Write the module**

```ts
// server/src/subscriptions/subscriptions.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { UsersModule } from '../users/users.module';
import { Subscription } from './entities/subscription.entity';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  imports: [TypeOrmModule.forFeature([Subscription, User]), UsersModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
```

Note: `SubscriptionsController` also needs `MercadoPagoService` — since that's not a Nest-managed provider yet in this module tree, this task adds it directly as a provider here too (it has no dependencies of its own beyond `ConfigService`, which is global):
```ts
import { MercadoPagoService } from '../payments/mercadopago.service';
// ...
providers: [SubscriptionsService, MercadoPagoService],
```

- [ ] **Step 3: Register in AppModule**

In `server/src/app.module.ts`, add the import and list it:
```ts
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
// ...
imports: [
  // ...existing entries...
  SubscriptionsModule,
],
```

- [ ] **Step 4: Manually verify**

Start the backend (`npm run dev:server`). With a customer token (mint one the same way earlier tasks did — insert a test user via psql, sign a JWT with `USER_JWT_SECRET` including `typ: 'customer'`):

```bash
curl -s http://localhost:3001/api/subscriptions/me -H "Authorization: Bearer $TOKEN"
```
Expected: `null` (no subscription exists yet — that's correct, nothing creates one until Task 10).

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE http://localhost:3001/api/subscriptions/me -H "Authorization: Bearer $TOKEN"
```
Expected: `404 {"error":"No tenés una suscripción activa."}`.

- [ ] **Step 5: Commit**

```bash
git add server/src/subscriptions/subscriptions.controller.ts server/src/subscriptions/subscriptions.module.ts server/src/app.module.ts
git commit -m "feat(server): customer-facing subscription endpoints"
```

---

## Task 9: One-off booking checkout (credit-covered path + payment path)

**Files:**
- Create: `server/src/payments/dto/create-checkout.dto.ts`
- Create: `server/src/payments/payments.controller.ts`
- Create: `server/src/payments/payments.module.ts`
- Modify: `server/src/app.module.ts`

**Interfaces:**
- Consumes: `BookingsService` (Task 3, now exported), `SubscriptionsService` (Task 7), `CheckoutReferenceService` (Task 4), `MercadoPagoService` (Task 6), `UsersService` (existing, for `isSocio`).
- Produces: `POST /api/bookings/checkout`. This task only implements the credit-covered path fully; the payment-preference-creation branch is written now but the resulting `initPoint` isn't exercised end-to-end until the final live-verification task.

- [ ] **Step 1: Write the DTO**

```ts
// server/src/payments/dto/create-checkout.dto.ts
import { IsIn, IsOptional, IsString } from 'class-validator';
import { SLOTS } from '../../catalog/catalog.constants';
import { IsBookingDate } from '../../bookings/validators/is-booking-date';

export class CreateCheckoutDto {
  @IsBookingDate()
  date: string;

  @IsIn(SLOTS, { message: 'Bloque horario no disponible.' })
  time: string;

  @IsOptional()
  @IsString()
  service?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
```

- [ ] **Step 2: Write the controller (booking-checkout endpoint only for now)**

```ts
// server/src/payments/payments.controller.ts
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { RESET_SESSION_PRICE } from '../catalog/catalog.constants';
import { BookingsService } from '../bookings/bookings.service';
import { CurrentUser } from '../users/decorators/current-user.decorator';
import { UserJwtAuthGuard } from '../users/guards/user-jwt-auth.guard';
import { AuthenticatedCustomer } from '../users/users.types';
import { UsersService } from '../users/users.service';
import { CheckoutReferenceService } from './checkout-reference.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { MercadoPagoService } from './mercadopago.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Controller()
@UseGuards(UserJwtAuthGuard)
export class PaymentsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly usersService: UsersService,
    private readonly checkoutReference: CheckoutReferenceService,
    private readonly mercadoPago: MercadoPagoService,
  ) {}

  @Post('bookings/checkout')
  async checkoutBooking(@Body() dto: CreateCheckoutDto, @CurrentUser() customer: AuthenticatedCustomer) {
    const hasCredit = await this.subscriptionsService.tryConsumeCredit(customer.id);
    if (hasCredit) {
      return this.bookingsService.create(dto, customer.id);
    }

    const user = await this.usersService.findById(customer.id);
    const amount = user?.isSocio ? RESET_SESSION_PRICE.priceSocioUyu : RESET_SESSION_PRICE.priceUyu;
    const siteUrl = process.env.SITE_URL ?? 'http://localhost:5173';

    const reference = this.checkoutReference.sign({
      kind: 'oneoff',
      userId: customer.id,
      date: dto.date,
      time: dto.time,
      service: dto.service,
      notes: dto.notes?.slice(0, 200),
    });

    const { initPoint } = await this.mercadoPago.createPreference({
      title: 'Recovery Room — Reset Session',
      amount,
      externalReference: reference,
      successUrl: `${siteUrl}/pago-pendiente?ref=${encodeURIComponent(reference)}`,
      failureUrl: `${siteUrl}/pago-pendiente?ref=${encodeURIComponent(reference)}&failed=1`,
      pendingUrl: `${siteUrl}/pago-pendiente?ref=${encodeURIComponent(reference)}`,
    });

    return { requiresPayment: true, initPoint, reference };
  }
}
```

- [ ] **Step 3: Write the module**

```ts
// server/src/payments/payments.module.ts
import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { UsersModule } from '../users/users.module';
import { CheckoutReferenceService } from './checkout-reference.service';
import { MercadoPagoService } from './mercadopago.service';
import { PaymentsController } from './payments.controller';

@Module({
  imports: [BookingsModule, SubscriptionsModule, UsersModule],
  controllers: [PaymentsController],
  providers: [MercadoPagoService, CheckoutReferenceService],
})
export class PaymentsModule {}
```

- [ ] **Step 4: Register in AppModule**

```ts
import { PaymentsModule } from './payments/payments.module';
// ...
imports: [
  // ...existing entries...
  PaymentsModule,
],
```

- [ ] **Step 5: Manually verify the credit-covered path**

Using a test user with an active subscription (insert directly via psql for now — a real one arrives once the subscription-checkout path, Task 10, is wired and end-to-end tested in the final task):
```sql
INSERT INTO subscriptions (user_id, plan, mp_preapproval_id, status, current_period_start, current_period_end, session_credits_remaining, session_credits_total)
VALUES ('<your test user id>', 'standard', 'test-preapproval-1', 'authorized', '2026-08-01', '2026-08-31', 4, 4);
```

```bash
curl -s -X POST http://localhost:3001/api/bookings/checkout \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"date":"2026-09-01","time":"08:00","service":"Recovery Room"}'
```
Expected: `201`-shaped response, same as the old direct booking endpoint (`{id, date, time, service, emailSent}`) — no payment involved. Confirm in the database that `sessionCreditsRemaining` dropped from 4 to 3 for that subscription row.

Then, for a user with **no** subscription and no remaining credits:
```bash
curl -s -X POST http://localhost:3001/api/bookings/checkout \
  -H "Authorization: Bearer $TOKEN_NO_CREDITS" -H 'content-type: application/json' \
  -d '{"date":"2026-09-02","time":"09:00","service":"Recovery Room"}'
```
Expected: with a placeholder `MP_ACCESS_TOKEN`, this will fail when it tries to actually call MercadoPago — that's expected at this stage (real credentials arrive in the final task). Confirm the failure happens specifically inside the MercadoPago call (i.e., the credit-check and DTO validation ran correctly first) by checking the error message names `MP_ACCESS_TOKEN`/`MercadoPago` rather than something else.

- [ ] **Step 6: Commit**

```bash
git add server/src/payments/dto/create-checkout.dto.ts server/src/payments/payments.controller.ts server/src/payments/payments.module.ts server/src/app.module.ts
git commit -m "feat(server): one-off booking checkout (credit-covered + payment-required paths)"
```

---

## Task 10: Subscription checkout

**Files:**
- Create: `server/src/payments/dto/create-subscription-checkout.dto.ts`
- Modify: `server/src/payments/payments.controller.ts`

**Interfaces:**
- Consumes: everything already injected into `PaymentsController` from Task 9.
- Produces: `POST /api/subscriptions/checkout`.

- [ ] **Step 1: Write the DTO**

```ts
// server/src/payments/dto/create-subscription-checkout.dto.ts
import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';
import { SLOTS } from '../../catalog/catalog.constants';
import { IsBookingDate } from '../../bookings/validators/is-booking-date';

class IntendedBookingDto {
  @IsBookingDate()
  date: string;

  @IsIn(SLOTS, { message: 'Bloque horario no disponible.' })
  time: string;

  @IsOptional()
  @IsString()
  service?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateSubscriptionCheckoutDto {
  @IsIn(['standard', 'premium'], { message: 'Plan inválido.' })
  plan: 'standard' | 'premium';

  @IsOptional()
  @ValidateNested()
  @Type(() => IntendedBookingDto)
  intendedBooking?: IntendedBookingDto;
}
```

- [ ] **Step 2: Add the endpoint**

In `server/src/payments/payments.controller.ts`, add the import and method (everything else in the file stays as Task 9 left it):

```ts
import { PLANS } from '../catalog/catalog.constants';
import { CreateSubscriptionCheckoutDto } from './dto/create-subscription-checkout.dto';

// ...inside PaymentsController:
  @Post('subscriptions/checkout')
  async checkoutSubscription(@Body() dto: CreateSubscriptionCheckoutDto, @CurrentUser() customer: AuthenticatedCustomer) {
    const user = await this.usersService.findById(customer.id);
    const plan = PLANS[dto.plan];
    const amount = user?.isSocio ? plan.priceSocioUyu : plan.priceUyu;
    const siteUrl = process.env.SITE_URL ?? 'http://localhost:5173';

    const reference = this.checkoutReference.sign({
      kind: 'subscription',
      userId: customer.id,
      plan: dto.plan,
      intendedBooking: dto.intendedBooking
        ? { ...dto.intendedBooking, notes: dto.intendedBooking.notes?.slice(0, 200) }
        : undefined,
    });

    const { initPoint } = await this.mercadoPago.createPreapproval({
      reason: plan.label,
      amount,
      payerEmail: user!.email,
      externalReference: reference,
      backUrl: `${siteUrl}/pago-pendiente?ref=${encodeURIComponent(reference)}`,
    });

    return { initPoint, reference };
  }
```

- [ ] **Step 3: Manually verify**

```bash
curl -s -X POST http://localhost:3001/api/subscriptions/checkout \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"plan":"premium"}'
```
Expected: same as Task 9's payment path — fails at the MercadoPago API call with the placeholder token, but confirm the DTO validation and reference-signing ran first (error names `MP_ACCESS_TOKEN`/`MercadoPago`, not a validation error).

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3001/api/subscriptions/checkout \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"plan":"deluxe"}'
```
Expected: `400 {"error":"Plan inválido."}`.

- [ ] **Step 4: Commit**

```bash
git add server/src/payments/dto/create-subscription-checkout.dto.ts server/src/payments/payments.controller.ts
git commit -m "feat(server): subscription checkout"
```

---

## Task 11: Webhook — one-off payment confirmation

**Files:**
- Create: `server/src/payments/dto/mp-webhook-query.dto.ts`
- Modify: `server/src/payments/payments.controller.ts`

**Interfaces:**
- Consumes: `verifyWebhookSignature` (Task 5), everything already injected into `PaymentsController`.
- Produces: `POST /api/payments/webhook` (payment topic only — the preapproval topic is Task 12).

- [ ] **Step 1: Write the query DTO**

MercadoPago sends the notification topic and data id as query parameters, not JSON body fields — this is a plain query-string shape, validated manually rather than via `class-validator` (no DTO class needed; handled directly in the controller with explicit checks, matching this codebase's existing style for query-param-only endpoints like `BookingsController.cancel`).

- [ ] **Step 2: Add the webhook endpoint (payment topic)**

In `server/src/payments/payments.controller.ts`:
- Add imports: `Headers`, `Query`, `HttpCode`, `HttpStatus`, `UnauthorizedException` from `@nestjs/common`; `verifyWebhookSignature` from `./webhook-signature.util`; `ConfigService` from `@nestjs/config`.
- Add `ConfigService` to the constructor (alongside the existing five dependencies).
- **This endpoint must NOT be guarded** — remove the class-level `@UseGuards(UserJwtAuthGuard)` decorator from `PaymentsController` (it currently guards every route in this controller) and instead apply `@UseGuards(UserJwtAuthGuard)` individually to the two existing methods (`checkoutBooking`, `checkoutSubscription`) from Tasks 9-10, leaving the new webhook method unguarded.

```ts
@Post('payments/webhook')
@HttpCode(HttpStatus.OK)
async webhook(
  @Query('type') type: string,
  @Query('data.id') dataId: string,
  @Headers('x-signature') xSignature: string,
  @Headers('x-request-id') xRequestId: string,
) {
  const secret = this.config.get<string>('MP_WEBHOOK_SECRET');
  if (!secret) throw new Error('Falta MP_WEBHOOK_SECRET.');

  const validSignature = verifyWebhookSignature({ xSignature: xSignature ?? '', xRequestId: xRequestId ?? '', dataId: dataId ?? '', secret });
  if (!validSignature) throw new UnauthorizedException('Firma inválida.');

  if (type === 'payment') {
    await this.handlePaymentWebhook(dataId);
  } else if (type === 'preapproval' || type === 'subscription_preapproval') {
    await this.handlePreapprovalWebhook(dataId);
  }
  // Cualquier otro topic (o uno que no reconocemos) se ignora silenciosamente
  // — MercadoPago espera un 200 igual, para no reintentar innecesariamente.

  return { received: true };
}

private async handlePaymentWebhook(paymentId: string): Promise<void> {
  const payment = await this.mercadoPago.getPayment(paymentId);
  if (payment.status !== 'approved' || !payment.externalReference) return;

  const intent = this.checkoutReference.verify(payment.externalReference);
  if (!intent || intent.kind !== 'oneoff') return;

  try {
    await this.bookingsService.create(
      { date: intent.date, time: intent.time, service: intent.service, notes: intent.notes },
      intent.userId,
      String(payment.id),
    );
  } catch {
    // El bloque ya no está disponible (alguien más lo tomó mientras se
    // procesaba el pago) — reembolsamos en vez de dejar cobrado sin turno.
    await this.mercadoPago.refundPayment(String(payment.id));
  }
}

private async handlePreapprovalWebhook(_preapprovalId: string): Promise<void> {
  // Implementado en la próxima tarea.
}
```

- [ ] **Step 3: Manually verify the signature rejection path**

Start the backend, then:
```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3001/api/payments/webhook?type=payment&data.id=123" \
  -X POST -H 'x-signature: ts=1,v1=deadbeef' -H 'x-request-id: test'
```
Expected: `401` (signature won't validate against a real `MP_WEBHOOK_SECRET` since `deadbeef` wasn't computed correctly) — confirms the guard rejects forged calls even with a real secret configured. Full payment-confirmation verification (a real signed webhook call) happens in the final live-verification task, since it requires an actual MercadoPago sandbox payment to trigger.

- [ ] **Step 4: Commit**

```bash
git add server/src/payments/payments.controller.ts
git commit -m "feat(server): MercadoPago webhook — one-off payment confirmation"
```

---

## Task 12: Webhook — subscription confirmation + auto-booking

**Files:**
- Modify: `server/src/payments/payments.controller.ts`
- Modify: `server/src/payments/payments.module.ts`

**Interfaces:**
- Consumes: `SubscriptionsService.createFromPreapproval`/`renewPeriod` (Task 7).
- Produces: completes `handlePreapprovalWebhook`.

- [ ] **Step 1: Implement the preapproval handler**

Replace the `handlePreapprovalWebhook` stub from Task 11 with:

```ts
private async handlePreapprovalWebhook(preapprovalId: string): Promise<void> {
  const data = await this.mercadoPago.getPreapproval(preapprovalId);
  if (data.status !== 'authorized' || !data.externalReference) return;

  const intent = this.checkoutReference.verify(data.externalReference);
  if (!intent || intent.kind !== 'subscription') return;

  const existing = await this.subscriptionsService.findByPreapprovalId(preapprovalId);
  const periodStart = todayStr();
  const periodEnd = addMonths(periodStart, 1);

  if (existing) {
    // Cobro recurrente de un ciclo posterior: renovar créditos.
    await this.subscriptionsService.renewPeriod(preapprovalId, periodStart, periodEnd);
  } else {
    await this.subscriptionsService.createFromPreapproval({
      userId: intent.userId,
      plan: intent.plan,
      mpPreapprovalId: preapprovalId,
      periodStart,
      periodEnd,
    });
  }

  if (intent.intendedBooking) {
    const hasCredit = await this.subscriptionsService.tryConsumeCredit(intent.userId);
    if (hasCredit) {
      await this.bookingsService.create(
        {
          date: intent.intendedBooking.date,
          time: intent.intendedBooking.time,
          service: intent.intendedBooking.service,
          notes: intent.intendedBooking.notes,
        },
        intent.userId,
      ).catch(() => {
        // El horario ya no está disponible — la suscripción sigue en pie,
        // el cliente elige otro horario con el crédito ya activado.
      });
    }
  }
}
```

This needs two additions:
1. `MercadoPagoService.getPreapproval(id)` — add alongside the existing methods in `server/src/payments/mercadopago.service.ts`:
```ts
async getPreapproval(preapprovalId: string): Promise<{ status: string; externalReference: string | null }> {
  const data = await this.request(`/preapproval/${preapprovalId}`, { method: 'GET' });
  return { status: data.status as string, externalReference: (data.external_reference as string | undefined) ?? null };
}
```
2. `SubscriptionsService.findByPreapprovalId(id)` — add to `server/src/subscriptions/subscriptions.service.ts`:
```ts
findByPreapprovalId(mpPreapprovalId: string): Promise<Subscription | null> {
  return this.subscriptionsRepo.findOne({ where: { mpPreapprovalId } });
}
```
3. A small date-math helper `addMonths` — add to `server/src/common/date.util.ts` (alongside the existing `todayStr`):
```ts
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + months, d));
  return dt.toISOString().slice(0, 10);
}
```

- [ ] **Step 2: Wire `SubscriptionsService` into `PaymentsModule`**

`SubscriptionsModule` already exports `SubscriptionsService` and `PaymentsModule` already imports `SubscriptionsModule` (from Task 9) — no module change needed, just confirm `PaymentsController`'s constructor already has `subscriptionsService` injected (it does, from Task 9).

- [ ] **Step 3: Verify**

Run `npm run build --workspace=server` — expect success. Run `npm test --workspace=server` — expect the existing test suites (checkout-reference, webhook-signature, subscriptions.service, users.service, google-token-verifier) to all still pass.

- [ ] **Step 4: Commit**

```bash
git add server/src/payments/payments.controller.ts server/src/payments/mercadopago.service.ts server/src/subscriptions/subscriptions.service.ts server/src/common/date.util.ts
git commit -m "feat(server): MercadoPago webhook — subscription confirmation and auto-booking"
```

---

## Task 13: Checkout-status polling endpoint

**Files:**
- Modify: `server/src/payments/payments.controller.ts`

**Interfaces:**
- Produces: `GET /api/bookings/checkout-status?ref=<reference>`.

- [ ] **Step 1: Add the endpoint**

```ts
@Get('bookings/checkout-status')
@UseGuards(UserJwtAuthGuard)
async checkoutStatus(@Query('ref') ref: string, @CurrentUser() customer: AuthenticatedCustomer) {
  const intent = this.checkoutReference.verify(ref);
  if (!intent || intent.userId !== customer.id) {
    return { status: 'invalid' };
  }

  if (intent.kind === 'oneoff') {
    const booking = await this.bookingsService.findByUserAndSlot(customer.id, intent.date, intent.time);
    return booking ? { status: 'completed', booking } : { status: 'pending' };
  }

  const subscription = await this.subscriptionsService.findCurrent(customer.id);
  if (!subscription) return { status: 'pending' };

  if (!intent.intendedBooking) return { status: 'completed', booking: null };

  const booking = await this.bookingsService.findByUserAndSlot(customer.id, intent.intendedBooking.date, intent.intendedBooking.time);
  return { status: 'completed', booking: booking ?? null };
}
```

Add `Get` to the existing `@nestjs/common` import line in this file.

- [ ] **Step 2: Add the lookup method `BookingsService` needs**

In `server/src/bookings/bookings.service.ts`, add:
```ts
findByUserAndSlot(userId: string, date: string, time: string): Promise<Booking | null> {
  return this.bookingsRepo.findOne({ where: { userId, date, time } });
}
```

- [ ] **Step 3: Manually verify**

```bash
# A reference for a booking that already exists (reuse one from Task 9's verification)
curl -s "http://localhost:3001/api/bookings/checkout-status?ref=<a-reference-you-signed-and-that-resolved-to-a-real-booking>" -H "Authorization: Bearer $TOKEN"
```
Expected: `{"status":"completed","booking":{...}}`.

```bash
curl -s "http://localhost:3001/api/bookings/checkout-status?ref=garbage" -H "Authorization: Bearer $TOKEN"
```
Expected: `{"status":"invalid"}`.

- [ ] **Step 4: Commit**

```bash
git add server/src/payments/payments.controller.ts server/src/bookings/bookings.service.ts
git commit -m "feat(server): checkout-status polling endpoint"
```

---

## Task 14: Retire the old direct booking endpoint; env var reporting

**Files:**
- Modify: `server/src/bookings/bookings.controller.ts`
- Modify: `server/src/diag/diag.service.ts`
- Modify: `DEPLOY.md`

**Interfaces:**
- Removes: `POST /api/bookings` (superseded by `POST /api/bookings/checkout` from Task 9).

- [ ] **Step 1: Remove the old endpoint**

In `server/src/bookings/bookings.controller.ts`, delete the entire `@Post()` `create(...)` method and its `UserJwtAuthGuard`/`CurrentUser`/`CreateBookingDto` imports that are no longer used elsewhere in this file (keep `GET`/`DELETE` and their imports exactly as they are).

- [ ] **Step 2: Report the three new env vars in `/api/diag`**

In `server/src/diag/diag.service.ts`, add `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `CHECKOUT_REFERENCE_SECRET` to the `env` object and extend the truncation condition (same pattern as `USER_JWT_SECRET` from the previous phase — all three are secrets, none should ever be shown in full):

```ts
const env = {
  // ...existing entries...
  MP_ACCESS_TOKEN: this.config.get<string>('MP_ACCESS_TOKEN'),
  MP_WEBHOOK_SECRET: this.config.get<string>('MP_WEBHOOK_SECRET'),
  CHECKOUT_REFERENCE_SECRET: this.config.get<string>('CHECKOUT_REFERENCE_SECRET'),
};
```
and in the truncation-condition loop, change:
```ts
k.includes('KEY') || k === 'DATABASE_URL' || k === 'JWT_SECRET' || k === 'USER_JWT_SECRET'
```
to also include `|| k === 'MP_ACCESS_TOKEN' || k === 'MP_WEBHOOK_SECRET' || k === 'CHECKOUT_REFERENCE_SECRET'`.

- [ ] **Step 3: Update `DEPLOY.md`**

Add `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `CHECKOUT_REFERENCE_SECRET` to the environment-variables table (same style as the `GOOGLE_CLIENT_ID`/`USER_JWT_SECRET` rows added in the previous phase), and add a short paragraph noting that the webhook URL (`<SITE_URL>/api/payments/webhook`) needs to be configured in the MercadoPago developer dashboard under Webhooks, which is where `MP_WEBHOOK_SECRET` comes from.

- [ ] **Step 4: Verify**

Run `npm run build --workspace=server` and `npm test --workspace=server` — expect success/9+ tests passing (no test covers the removed endpoint directly). Run `npx tsc -b --noEmit` from the repo root to catch any now-unused frontend import of the old booking creation shape (there shouldn't be any yet — the frontend still calls the old endpoint until Task 16, which is fine, that task replaces the call site).

- [ ] **Step 5: Commit**

```bash
git add server/src/bookings/bookings.controller.ts server/src/diag/diag.service.ts DEPLOY.md
git commit -m "feat(server): retire the old direct booking endpoint, report new env vars"
```

---

## Task 15: Backend full manual verification

**Files:** none (verification-only task)

- [ ] **Step 1: Full route map sanity check**

Start the backend (`npm run dev:server`) and confirm the startup log shows exactly these routes (no more, no less, for everything touched by this plan): `POST /api/bookings/checkout`, `POST /api/subscriptions/checkout`, `POST /api/payments/webhook`, `GET /api/bookings/checkout-status`, `GET /api/subscriptions/me`, `DELETE /api/subscriptions/me` — and confirm `POST /api/bookings` (the old endpoint) is **gone** from the route list.

- [ ] **Step 2: Re-run the full curl sequence from Tasks 9, 10, 11, 13** against the current code, end to end in one sitting, to catch any integration drift between tasks (each task's own verification was done incrementally — this step is a single continuous pass): credit-covered checkout, no-credit checkout (fails at the MercadoPago call as expected with a placeholder token), subscription checkout (same), webhook signature rejection, checkout-status for a real completed booking and for a garbage reference.

- [ ] **Step 3: Run the full test suite**

`npm test --workspace=server` — expect all unit tests (checkout-reference, webhook-signature, subscriptions.service, users.service, google-token-verifier) passing, and `npm run build` (both server and frontend) succeeding.

- [ ] **Step 4: Report findings**

Write a short report to the plan's SDD workspace noting the route list confirmed, and any discrepancy found during the continuous re-run (there shouldn't be any if Tasks 9-14 were each verified correctly, but this step exists specifically to catch the case where an earlier task's manual verification passed in isolation but something later broke it).

No commit for this task (verification-only, no file changes expected — if something needs fixing, note it and let the controller decide whether it's a fix-now item or was already covered by a later task).

---

## Task 16: Frontend types + RTK Query endpoints

**Files:**
- Create: `src/types/subscription.types.ts`
- Modify: `src/features/api/userApi.ts`

**Interfaces:**
- Produces: `useCreateBookingCheckoutMutation` (replaces the plain `createBooking` mutation from the previous phase), `useCreateSubscriptionCheckoutMutation`, `useGetCheckoutStatusQuery`, `useGetMySubscriptionQuery`, `useCancelSubscriptionMutation`.

- [ ] **Step 1: Write the types**

```ts
// src/types/subscription.types.ts
export interface Subscription {
  plan: 'standard' | 'premium';
  status: 'authorized' | 'cancelled';
  currentPeriodEnd: string;
  sessionCreditsRemaining: number;
  sessionCreditsTotal: number;
}

export interface CheckoutResult {
  id?: number;
  date?: string;
  time?: string;
  service?: string;
  emailSent?: boolean;
  requiresPayment?: boolean;
  initPoint?: string;
  reference?: string;
}

export interface CheckoutStatus {
  status: 'completed' | 'pending' | 'invalid';
  booking?: unknown;
}
```

- [ ] **Step 2: Replace `createBooking` with the checkout mutation and add the new endpoints**

In `src/features/api/userApi.ts`, replace the existing `createBooking` endpoint definition with:

```ts
createBookingCheckout: builder.mutation<CheckoutResult, CreateBookingRequest>({
  query: (body) => ({ url: '/bookings/checkout', method: 'POST', data: body }),
  invalidatesTags: ['MyBookings'],
}),
createSubscriptionCheckout: builder.mutation<
  { initPoint: string; reference: string },
  { plan: 'standard' | 'premium'; intendedBooking?: CreateBookingRequest }
>({
  query: (body) => ({ url: '/subscriptions/checkout', method: 'POST', data: body }),
}),
getCheckoutStatus: builder.query<CheckoutStatus, string>({
  query: (ref) => ({ url: '/bookings/checkout-status', method: 'GET', params: { ref } }),
}),
getMySubscription: builder.query<Subscription | null, void>({
  query: () => ({ url: '/subscriptions/me', method: 'GET' }),
  providesTags: ['MySubscription'],
}),
cancelSubscription: builder.mutation<{ ok: true }, void>({
  query: () => ({ url: '/subscriptions/me', method: 'DELETE' }),
  invalidatesTags: ['MySubscription'],
}),
```

Add the new type imports at the top of the file (`CheckoutResult`, `CheckoutStatus`, `Subscription` from `'../../types/subscription.types'`), add `'MySubscription'` to `userApi`'s `tagTypes` array (alongside the existing `'MyBookings'`), and update the exports at the bottom:
```ts
export const {
  useLoginWithGoogleMutation,
  useGetMeQuery,
  useCompleteProfileMutation,
  useGetMyBookingsQuery,
  useCreateBookingCheckoutMutation,
  useCreateSubscriptionCheckoutMutation,
  useGetCheckoutStatusQuery,
  useLazyGetCheckoutStatusQuery,
  useGetMySubscriptionQuery,
  useCancelSubscriptionMutation,
} = userApi;
```

- [ ] **Step 3: Verify**

Run `npx tsc -b --noEmit` from the repo root — expect errors in `src/hooks/useBookingFlow.ts` (it still imports the now-removed `useCreateBookingMutation`) — this is expected and fixed in Task 17, not this task. Confirm the errors are confined to that one file.

- [ ] **Step 4: Commit**

```bash
git add src/types/subscription.types.ts src/features/api/userApi.ts
git commit -m "feat(web): checkout and subscription RTK Query endpoints"
```

---

## Task 17: Booking flow — credit check + pay/subscribe choice

**Files:**
- Modify: `src/hooks/useBookingFlow.ts`
- Create: `src/components/booking/PaymentChoice/index.tsx`
- Modify: `src/components/booking/BookingSection/index.tsx`
- Modify: `src/components/booking/BookingForm/index.tsx`

**Interfaces:**
- Consumes: `useCreateBookingCheckoutMutation`, `useCreateSubscriptionCheckoutMutation`, `useGetMySubscriptionQuery` (Task 16).

- [ ] **Step 1: Update `useBookingFlow`**

Replace the import and the `submitBooking` function in `src/hooks/useBookingFlow.ts`:

```ts
import { useCreateBookingCheckoutMutation, useCreateSubscriptionCheckoutMutation, useGetMySubscriptionQuery } from '../features/api/userApi';
```

Add, inside the hook (alongside the existing state):
```ts
const { data: subscription } = useGetMySubscriptionQuery();
const [createBookingCheckout, { isLoading: isSubmitting }] = useCreateBookingCheckoutMutation();
const [createSubscriptionCheckout] = useCreateSubscriptionCheckoutMutation();

const hasCredits = Boolean(subscription && subscription.currentPeriodEnd >= todayStr() && subscription.sessionCreditsRemaining > 0);
```

Replace the existing `submitBooking` with two functions:
```ts
const submitBooking = async (values: ClientFieldsValues): Promise<CreateBookingResponse> => {
  if (!selectedTime) throw new Error('Elegí un horario.');
  const result = await createBookingCheckout({ ...values, date, time: selectedTime, service }).unwrap();
  if (result.requiresPayment && result.initPoint) {
    window.location.assign(result.initPoint);
    return new Promise(() => {}); // navigating away, this promise never needs to resolve
  }
  setSelectedTime(null);
  return result as CreateBookingResponse;
};

const subscribeAndBook = async (plan: 'standard' | 'premium'): Promise<void> => {
  if (!selectedTime) throw new Error('Elegí un horario.');
  const { initPoint } = await createSubscriptionCheckout({
    plan,
    intendedBooking: { date, time: selectedTime, service },
  }).unwrap();
  window.location.assign(initPoint);
};
```

Return both from the hook (alongside the existing returned values):
```ts
return {
  // ...all existing returned fields...
  submitBooking,
  subscribeAndBook,
  hasCredits,
  isSubmitting,
};
```

- [ ] **Step 2: Write the payment/subscribe choice component**

```tsx
// src/components/booking/PaymentChoice/index.tsx
import { useState } from 'react';
import { extractApiErrorMessage } from '../../../lib/apiError';
import { Button } from '../../ui/button';

interface PaymentChoiceProps {
  resetSessionPrice: number;
  onPayOneOff: () => Promise<unknown>;
  onSubscribe: (plan: 'standard' | 'premium') => Promise<void>;
}

export const PaymentChoice = ({ resetSessionPrice, onPayOneOff, onSubscribe }: PaymentChoiceProps): JSX.Element => {
  const [isLoading, setIsLoading] = useState<'oneoff' | 'standard' | 'premium' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (key: 'oneoff' | 'standard' | 'premium', action: () => Promise<unknown>) => {
    setIsLoading(key);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(extractApiErrorMessage(err));
      setIsLoading(null);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-7">
      <h3 className="mb-2 text-lg uppercase tracking-wide">No tenés un plan activo</h3>
      <p className="mb-4 text-sm text-muted-foreground">Elegí cómo querés pagar esta sesión.</p>

      <Button type="button" size="block" disabled={isLoading !== null} onClick={() => run('oneoff', onPayOneOff)}>
        {isLoading === 'oneoff' ? 'Redirigiendo…' : `Pagar $${resetSessionPrice} (esta sesión)`}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="block"
        disabled={isLoading !== null}
        onClick={() => run('standard', () => onSubscribe('standard'))}
      >
        {isLoading === 'standard' ? 'Redirigiendo…' : 'Suscribirme a Standard Reset ($2400/mes · 4 sesiones)'}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="block"
        disabled={isLoading !== null}
        onClick={() => run('premium', () => onSubscribe('premium'))}
      >
        {isLoading === 'premium' ? 'Redirigiendo…' : 'Suscribirme a Premium Reset ($3840/mes · 8 sesiones)'}
      </Button>

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
};
```

(Prices are hardcoded here deliberately — this component is presentational and the plan already fixed these amounts; if pricing ever needs to come from the API instead of being duplicated in the frontend, that's a follow-up, not required by this plan.)

- [ ] **Step 3: Wire it into `BookingSection`**

In `src/components/booking/BookingSection/index.tsx`, destructure the new fields from `useBookingFlow()` (`hasCredits`, `subscribeAndBook`) alongside the existing ones, import `PaymentChoice`, and replace the `<BookingForm ... />` call with a conditional:

```tsx
{hasCredits ? (
  <BookingForm date={date} selectedTime={selectedTime} isSubmitting={isSubmitting} onSubmit={submitBooking} />
) : (
  <PaymentChoice resetSessionPrice={600} onPayOneOff={() => submitBooking({ notes: '' })} onSubscribe={subscribeAndBook} />
)}
```

(`resetSessionPrice={600}` is the non-socio price shown before checkout — the actual charged amount, socio-adjusted, is computed server-side in Task 9; this is just the displayed estimate. If a future task wants to show the discounted price to known-socio customers before they even click, that's a small enhancement, not required here.)

- [ ] **Step 4: Verify**

Run `npx tsc -b --noEmit` (expect exit 0 now — this fixes the errors Task 16 left) and `npm run build` (expect success).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useBookingFlow.ts src/components/booking/PaymentChoice src/components/booking/BookingSection/index.tsx
git commit -m "feat(web): booking flow offers pay-per-session or subscribe when no credits remain"
```

---

## Task 18: Checkout-pending page

**Files:**
- Create: `src/pages/CheckoutPendingPage/index.tsx`
- Modify: `src/routes/router.tsx`

**Interfaces:**
- Consumes: `useLazyGetCheckoutStatusQuery` (Task 16).

- [ ] **Step 1: Write the page**

```tsx
// src/pages/CheckoutPendingPage/index.tsx
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLazyGetCheckoutStatusQuery } from '../../features/api/userApi';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

const POLL_INTERVAL_MS = 2000;
const MAX_ATTEMPTS = 30; // ~1 minuto

export const CheckoutPendingPage = (): JSX.Element => {
  useDocumentTitle('Confirmando tu pago · MOVE®');
  const [searchParams] = useSearchParams();
  const ref = searchParams.get('ref') ?? '';
  const failed = searchParams.get('failed') === '1';
  const [trigger, { data }] = useLazyGetCheckoutStatusQuery();
  const [attempts, setAttempts] = useState(0);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!ref || failed || data?.status === 'completed' || data?.status === 'invalid') return;
    if (attempts >= MAX_ATTEMPTS) {
      setTimedOut(true);
      return;
    }
    const timer = setTimeout(() => {
      trigger(ref);
      setAttempts((a) => a + 1);
    }, POLL_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [ref, failed, data, attempts, trigger]);

  if (failed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-5 text-center">
        <p className="font-heading text-xl uppercase tracking-wide">El pago no se pudo completar</p>
        <p className="text-muted-foreground">Podés intentar de nuevo desde la sección de reservas.</p>
        <Link to="/#reservar" className="underline">Volver a reservar</Link>
      </div>
    );
  }

  if (data?.status === 'completed') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-5 text-center">
        <p className="font-heading text-xl uppercase tracking-wide text-success">¡Listo!</p>
        <p className="text-muted-foreground">Tu reserva quedó confirmada.</p>
        <Link to="/mi-cuenta" className="underline">Ver mi cuenta</Link>
      </div>
    );
  }

  if (data?.status === 'invalid' || timedOut) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-5 text-center">
        <p className="font-heading text-xl uppercase tracking-wide">No pudimos confirmar automáticamente</p>
        <p className="text-muted-foreground">Si ya pagaste, revisá tu email — te va a llegar la confirmación en cuanto se procese. Si algo no cierra, escribinos.</p>
        <Link to="/mi-cuenta" className="underline">Ver mi cuenta</Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-5 text-center">
      <p className="font-heading text-xl uppercase tracking-wide">Confirmando tu pago…</p>
      <p className="text-muted-foreground">Esto puede tardar unos segundos.</p>
    </div>
  );
};
```

- [ ] **Step 2: Add the route**

In `src/routes/router.tsx`, add (public, no guard needed — the endpoint itself is guarded and checks the reference belongs to the caller):

```tsx
{
  path: '/pago-pendiente',
  lazy: async () => {
    const { CheckoutPendingPage } = await import('../pages/CheckoutPendingPage');
    return { Component: CheckoutPendingPage };
  },
},
```

- [ ] **Step 3: Verify**

Run `npx tsc -b --noEmit` and `npm run build` — expect both to succeed.

- [ ] **Step 4: Commit**

```bash
git add src/pages/CheckoutPendingPage src/routes/router.tsx
git commit -m "feat(web): checkout-pending polling page"
```

---

## Task 19: Mi cuenta — real plan data + cancel

**Files:**
- Modify: `src/pages/MiCuentaPage/index.tsx`
- Create: `src/components/account/CancelSubscriptionDialog/index.tsx`

**Interfaces:**
- Consumes: `useGetMySubscriptionQuery`, `useCancelSubscriptionMutation` (Task 16).

- [ ] **Step 1: Write the cancel-confirmation dialog**

```tsx
// src/components/account/CancelSubscriptionDialog/index.tsx
import { useState } from 'react';
import { useCancelSubscriptionMutation } from '../../../features/api/userApi';
import { extractApiErrorMessage } from '../../../lib/apiError';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../ui/alert-dialog';

interface CancelSubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPeriodEnd: string;
}

export const CancelSubscriptionDialog = ({ open, onOpenChange, currentPeriodEnd }: CancelSubscriptionDialogProps): JSX.Element => {
  const [cancelSubscription, { isLoading }] = useCancelSubscriptionMutation();
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async (event: React.MouseEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await cancelSubscription().unwrap();
      onOpenChange(false);
    } catch (err) {
      setError(extractApiErrorMessage(err));
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar suscripción</AlertDialogTitle>
          <AlertDialogDescription>
            No se te va a cobrar de nuevo. Vas a poder seguir usando tus sesiones restantes hasta el {currentPeriodEnd}.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel>Volver</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? 'Cancelando…' : 'Cancelar suscripción'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
```

(This mirrors `CancelBookingDialog`'s exact `preventDefault`-on-Action pattern, established in the previous phase.)

- [ ] **Step 2: Replace the plan placeholder in `MiCuentaPage`**

In `src/pages/MiCuentaPage/index.tsx`, import `useGetMySubscriptionQuery` and `CancelSubscriptionDialog`, add local state for the dialog, and replace the `<Card className="p-6">...Sin plan activo todavía...</Card>` block with:

```tsx
const { data: subscription } = useGetMySubscriptionQuery();
const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

// ...in the JSX, replacing the old plan placeholder card:
<Card className="p-6">
  <h2 className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Tu plan</h2>
  {subscription ? (
    <div className="space-y-2">
      <p className="text-foreground">
        {subscription.plan === 'standard' ? 'Standard Reset' : 'Premium Reset'} — {subscription.sessionCreditsRemaining} de{' '}
        {subscription.sessionCreditsTotal} sesiones restantes este mes
      </p>
      <p className="text-sm text-muted-foreground">Vence el {subscription.currentPeriodEnd}</p>
      {subscription.status === 'authorized' && (
        <Button type="button" variant="ghost" size="sm" onClick={() => setCancelDialogOpen(true)}>
          Cancelar suscripción
        </Button>
      )}
      <CancelSubscriptionDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen} currentPeriodEnd={subscription.currentPeriodEnd} />
    </div>
  ) : (
    <p className="text-foreground">Sin plan activo todavía.</p>
  )}
</Card>
```

Add the necessary new imports at the top of the file (`useState` from `react` if not already imported, `Button` from `../../components/ui/button`, `CancelSubscriptionDialog` from `../../components/account/CancelSubscriptionDialog`).

- [ ] **Step 3: Verify**

Run `npx tsc -b --noEmit` and `npm run build` — expect both to succeed.

- [ ] **Step 4: Commit**

```bash
git add src/pages/MiCuentaPage/index.tsx src/components/account/CancelSubscriptionDialog
git commit -m "feat(web): mi cuenta shows real plan data and lets customers cancel"
```

---

## Task 20: Full live verification with a real MercadoPago sandbox account

**Files:** none (verification-only task)

This is the equivalent of the previous phase's real-Google-account step — it requires the controller/human to obtain real MercadoPago **test** credentials (a MercadoPago developer account has a "Test users" / sandbox mode with fake buyer accounts and test cards that simulate real payments without moving real money):

1. In the MercadoPago Developers panel (`https://www.mercadopago.com.uy/developers/panel/app`), create or use an existing application, grab its **Test** `Access Token` (`MP_ACCESS_TOKEN`).
2. Configure a webhook URL pointing at a publicly reachable tunnel to `localhost:3001/api/payments/webhook` (e.g. via `ngrok` or similar — MercadoPago cannot reach `localhost` directly) and copy the webhook secret it generates (`MP_WEBHOOK_SECRET`).
3. Generate a random string for `CHECKOUT_REFERENCE_SECRET` (this one has no external counterpart — any long random value works, it's purely internal).
4. Set all three in `.env`.

With real credentials in place:
- [ ] Book a session as a test customer with no credits and no subscription → confirm redirect to MercadoPago's sandbox checkout → pay with a MercadoPago test card → confirm redirect back to `/pago-pendiente` → confirm it polls to `completed` and the booking shows up in `/mi-cuenta`.
- [ ] Subscribe to a plan with an intended slot selected → authorize the test subscription on MercadoPago's page → confirm the webhook creates the `Subscription` row and auto-books the originally-selected slot → confirm `/mi-cuenta` shows the plan with the right credit count.
- [ ] Book again with the now-active subscription → confirm it completes instantly with no MercadoPago redirect (credit-covered path) and the credit count decrements.
- [ ] Cancel the subscription from `/mi-cuenta` → confirm MercadoPago shows it cancelled, and confirm booking still works (credits still consumable) until `currentPeriodEnd`.
- [ ] Deliberately book the same slot as someone else while a payment is "in flight" (two browser sessions) to exercise the refund path, if practical to simulate; otherwise, note this as unverified-in-practice and rely on the code review's confirmation of the refund call being correctly wired.

Report the outcome of each check plainly — if MercadoPago's sandbox has quirks not anticipated in this plan (exact webhook payload shape, timing), note the discrepancy and treat fixing it as a normal fix-round finding, not a plan failure.

---

## Self-Review Notes

- **Spec coverage:** every section of the design doc maps to a task — plans/pricing (Task 1), data model (Tasks 2-3), signed references + webhook signatures (Tasks 4-5), MercadoPago client (Task 6), credit logic (Task 7), subscription endpoints (Task 8), one-off checkout (Task 9), subscription checkout (Task 10), webhook handling for both topics including the refund and auto-book-tolerant-of-race behaviors (Tasks 11-12), status polling (Task 13), retiring the old endpoint (Task 14), and every frontend consumer (Tasks 16-19). Out-of-scope items from the spec (coupon stacking, refund/dispute handling beyond the two named cases, revenue reporting) are not present anywhere in this plan.
- **Type consistency checked:** `CheckoutIntent` (Task 4) is produced by `CheckoutReferenceService.sign`/`verify` and consumed identically in Tasks 9-13. `Subscription` entity fields (Task 2) match what `SubscriptionsService` (Task 7) reads/writes and what `SubscriptionsController` (Task 8) serializes for the frontend `Subscription` type (Task 16).
- **No circular module dependency:** `PaymentsModule` sits above `BookingsModule`/`SubscriptionsModule`/`UsersModule`; none of those three import `PaymentsModule` or each other in a new direction beyond the already-established `BookingsModule → UsersModule` edge.
- **Placeholder scan:** none found — every step has complete, concrete code. The one deliberate exception is Task 20, which is explicitly a live-verification task requiring external credentials, matching the same pattern the previous phase used for the real Google account step.
