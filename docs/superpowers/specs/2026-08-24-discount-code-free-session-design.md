# Discount code for a free session — design

## Context

The business wants a way to hand out a single free Recovery Room (or any catalog service) session via a link, e.g. to share on Instagram or with a specific person. Today there's no discount/coupon concept anywhere in the codebase (`server/src`, `src`): pricing (`docs/superpowers/specs/2026-08-13-configurable-pricing-design.md`) only knows about socio vs. non-socio prices, both fully paid through MercadoPago.

Scope, per decisions already made with the user:

- **One global code at a time** (not a table of many named codes) — an admin edits `code` + `active` from the existing pricing admin page. No expiration date, no total-redemption cap.
- **One free session in total per user**, regardless of how many times the global code changes — once a user redeems, they can never redeem again (there's no "per code" bookkeeping).
- Redeeming **skips payment entirely** — same code path as an existing subscription credit, not a $0 MercadoPago checkout.
- Applies to **any service in the catalog**, not just Recovery Room specifically — this requires no extra work since `checkoutBooking` already books whatever `service` the client sent, regardless of payment path.
- The code is shared via a link (`?promo=CODE`) that pre-fills an input in the booking flow; it isn't advertised as a public "have a coupon?" affordance to every visitor.

This reuses the exact structural pattern the credits system already established: `SubscriptionsService.tryConsumeCredit()` is an atomic conditional `UPDATE ... WHERE ... > 0`, and `PaymentsController.checkoutBooking` calls it before falling through to a paid checkout, with a compensating "restore" call if booking creation fails afterward. The free-session code does the same thing against a boolean-ish column on `users` instead of a credits counter.

## Data model

Two independent additions, in separate migrations (following the existing convention of one migration per entity change, e.g. `CreatePricingSettings` then later `AddFirstSessionPriceToPricingSettings`):

**New table `discount_code_settings`** (singleton row, same shape as `pricing_settings`):

```ts
// server/src/discount-codes/entities/discount-code-settings.entity.ts
@Entity('discount_code_settings')
export class DiscountCodeSettings {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'text' }) code: string;
  @Column({ type: 'boolean', default: false }) active: boolean;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
```

Migration seeds one row with `code: ''`, `active: false` — mirrors `PricingSettings`' "throw if the table is empty" defensiveness (a missing row means the migration didn't run) while defaulting to *off* so nothing is redeemable until an admin deliberately sets a code and flips it active.

**New column on `users`**: `free_session_redeemed_at: timestamptz | null`, default `null`. Non-null means "this user already used their one free session via a discount code, ever."

```ts
// server/src/users/entities/user.entity.ts — add:
@Column({ name: 'free_session_redeemed_at', type: 'timestamptz', nullable: true })
freeSessionRedeemedAt: Date | null;
```

## Backend

**New `DiscountCodesModule`** (`server/src/discount-codes/`), following the one-module-per-domain convention (mirrors `PricingModule` exactly):

- `DiscountCodesService.getCurrent()`: returns the singleton row (throws `InternalServerErrorException` if missing, same as `PricingService.getCurrent()`).
- `DiscountCodesService.update(dto)`: admin sets `code` + `active`.
- `DiscountCodesService.isCodeValid(submitted: string)`: `true` only if `active` and `submitted.trim().toLowerCase() === code.trim().toLowerCase()`. Trimmed/case-insensitive so a stray space or shift-key typo from a manually-typed code doesn't fail silently.
- `DiscountCodesController` — `GET`/`PUT /api/admin/discount-code`, guarded by `JwtAuthGuard`, `UpdateDiscountCodeDto` (`code: string`, `active: boolean`, validated with `class-validator`).

**`UsersService`** gains the atomic redemption pair (same shape as `SubscriptionsService.tryConsumeCredit`/`restoreCredit`):

```ts
async tryRedeemFreeSession(userId: string): Promise<boolean> {
  const result = await this.usersRepo
    .createQueryBuilder()
    .update(User)
    .set({ freeSessionRedeemedAt: () => 'now()' })
    .where('id = :id AND free_session_redeemed_at IS NULL', { id: userId })
    .execute();
  return (result.affected ?? 0) > 0;
}

async restoreFreeSession(userId: string): Promise<void> {
  await this.usersRepo
    .createQueryBuilder()
    .update(User)
    .set({ freeSessionRedeemedAt: null })
    .where('id = :id', { id: userId })
    .execute();
}
```

`tryRedeemFreeSession`'s conditional `WHERE free_session_redeemed_at IS NULL` is what makes two simultaneous requests from the same user unable to both succeed — same race condition `tryConsumeCredit` already guards against.

**`PaymentsController.checkoutBooking`** gains a new branch between the existing credit check and the paid-checkout fallback:

```ts
const hasCredit = await this.subscriptionsService.tryConsumeCredit(customer.id);
if (hasCredit) { /* ...unchanged... */ }

if (dto.discountCode) {
  const validCode = await this.discountCodesService.isCodeValid(dto.discountCode);
  if (!validCode) throw new BadRequestException('Código de descuento inválido.');
  const redeemed = await this.usersService.tryRedeemFreeSession(customer.id);
  if (!redeemed) throw new ConflictException('Ya usaste tu sesión gratis con código de descuento.');
  try {
    return await this.bookingsService.create(dto, customer.id);
  } catch (e) {
    await this.usersService.restoreFreeSession(customer.id);
    throw e;
  }
}

// ...unchanged paid fallback...
```

`CreateCheckoutDto` gains `@IsOptional() @IsString() discountCode?: string`. When the field is absent (the normal paid flow, or the credits flow), behavior is unchanged — this only activates when the client explicitly sends a code.

`PaymentsModule` imports `DiscountCodesModule` (for `DiscountCodesService`) alongside its existing `PricingModule`/`SubscriptionsModule` imports.

## Frontend

- `src/schemas/booking.schema.ts`: `clientFieldsSchema` gains `discountCode: z.string().optional()`. `CreateBookingRequest`/`ClientFieldsValues` follow the same shape (`discountCode?: string`), same as the existing `notes?: string`.
- `useBookingFlow.ts`: reads `?promo=` once via `useSearchParams()` (react-router-dom, same as `CheckoutPendingPage`'s `ref`/`failed` precedent) and returns it as `initialDiscountCode: string | null`. No other state threading needed — `submitBooking` already spreads whatever values it's given into the checkout request body, so passing `{ notes, discountCode }` through the existing path is enough.
- `PaymentChoice`: new props `initialDiscountCode?: string | null` and `onRedeemFreeSession: (code: string, notes: string) => Promise<CreateBookingResponse>`.
  - The code input **only renders when `initialDiscountCode` is truthy** (i.e., the visitor arrived via a promo link) — it's not a general "have a coupon?" affordance shown to every visitor, matching the "shared via link" intent.
  - Local state `const [discountCode, setDiscountCode] = useState(initialDiscountCode ?? '')`, editable in case they need to fix a typo.
  - New button "Usar código (sesión gratis)" alongside the existing pay/subscribe buttons, wired through the same `run()` helper already in the component. On success, shows an inline confirmation message (mirroring `BookingForm`'s `result.emailSent` message), since there's no `initPoint` to redirect to. On failure, the existing `error` state/display already handles it via `extractApiErrorMessage`.
- `BookingSection`: threads `initialDiscountCode` from `useBookingFlow` down to `PaymentChoice`, and wires `onRedeemFreeSession={(code, notes) => submitBooking({ notes, discountCode: code })}` — reusing `submitBooking` as-is (it already returns the created booking when the response has no `requiresPayment`).

## Admin

- Extend the existing `AdminPricingPage` with a new `<fieldset>` "Código de descuento" (code text input + active checkbox), not a new route/page — matches what was agreed.
- New `src/features/api/discountCodeApi.ts` (RTK Query), mirroring `pricingApi.ts`: `useGetAdminDiscountCodeQuery` / `useUpdateDiscountCodeMutation` against `/admin/discount-code`.
- New Zod schema `discountCodeSchema` (`code: z.string().min(1)`, `active: z.boolean()`) in `src/schemas/`, combined into the same page's form state alongside `pricingSchema` (two independent `useForm` instances, two independent submit buttons — they're unrelated settings that happen to share a page).

## Socio 50% messaging (bounded, same PR)

- `PaymentChoice`: when `isSocio`, append "(50% OFF)" next to the socio price label already shown; when not `isSocio`, add a small note above the payment buttons: "Los socios de MOVE ahorran 50% en sesiones y planes."
- `AdminPricingPage`: next to each `*PriceSocioUyu` input, a computed `<span>` showing the live discount percentage vs. its paired regular-price field (`useWatch` from react-hook-form, no new state), styled as a warning color when it's not close to 50% (e.g. outside 45–55%). Purely visual — no validation blocks saving, per the earlier decision to keep both fields freely editable.

## Error handling / edge cases

- **Wrong or inactive code**: `BadRequestException('Código de descuento inválido.')` — same user-facing error shape as everywhere else in the app.
- **Already redeemed** (by this user, ever): `ConflictException('Ya usaste tu sesión gratis con código de descuento.')`.
- **Race — two simultaneous redemption attempts by the same user**: the conditional `UPDATE ... WHERE free_session_redeemed_at IS NULL` guarantees only one can flip the flag; the loser gets `false` from `tryRedeemFreeSession` and the controller throws the same `ConflictException` as an already-used code.
- **Booking creation fails after redemption** (block taken concurrently, incomplete profile): `restoreFreeSession` resets the flag to `null` so the user doesn't lose their one free session to a booking that never happened — exact same compensating pattern as `restoreCredit`.
- **No settings row** (defensive, shouldn't happen post-migration): `getCurrent()` throws loudly rather than treating a missing row as "no active code."

## Testing

- `users.service.spec.ts`: `tryRedeemFreeSession` succeeds once and fails on a second call for the same user; `restoreFreeSession` clears the flag.
- `discount-codes.service.spec.ts` (new): `isCodeValid` — case/whitespace-insensitive match, `false` when inactive, `false` when code doesn't match.
- `payments.controller` (or an integration-style test if one exists for `checkoutBooking`): invalid code → 400; valid code + first redemption → booking created, no MercadoPago call; valid code + already-redeemed user → 409.

## Out of scope

- Multiple named/simultaneous codes, expiration dates, per-code usage caps — all explicitly deferred per the earlier decision (single global code, no expiry).
- A "validate code" endpoint queried before submission — the existing checkout endpoint's error response is the only feedback mechanism, kept minimal per YAGNI.
- Enforcing socio price as exactly 50% of the regular price in code/validation — prices stay fully independent, admin-edited fields; the percentage display is informational only.
- Any change to how `isSocio` itself is granted (still the existing `AdminUsersPage` toggle).
