# Configurable plan pricing — design

## Context

The original pricing design (`docs/superpowers/specs/2026-08-05-plans-mercadopago-payments-design.md`) defined `PLANS`/`RESET_SESSION_PRICE` as code constants in `server/src/catalog/catalog.constants.ts`, explicitly reasoning that "these change rarely and a deploy is an acceptable way to change pricing." That's no longer true for the price fields specifically: the user wants to test price changes from the admin panel without a deploy. This spec moves **only the price fields** (`priceUyu`, `priceSocioUyu` — for standard, premium, and the one-off reset session) into the database, editable from a new admin page. `label` and `sessionsPerMonth` stay as code constants; they're not in scope.

Today, pricing is inconsistently sourced:
- **Server-side** (the amount actually charged): `payments.controller.ts` imports `PLANS`/`RESET_SESSION_PRICE` directly from `catalog.constants.ts` to compute the MercadoPago checkout/preapproval amount.
- **Public config** (`GET /api/config`, `CatalogController`): returns only `{ slots, servicios }` — no pricing at all.
- **Frontend display** (`PaymentChoice/index.tsx`): hardcodes its own manual mirror of the constants (`RESET_SESSION_PRICE`, `PLAN_PRICES`), independent of both of the above.

Making pricing admin-editable requires all three call sites to read from the same source, or the admin's change would silently apply to only one of "what's displayed" and "what's charged."

## Data model

New table `pricing_settings`, a single row (no per-user/per-plan rows — there is exactly one active price set at any time, matching how `PLANS`/`RESET_SESSION_PRICE` work today):

```ts
// server/src/pricing/entities/pricing-settings.entity.ts
@Entity('pricing_settings')
export class PricingSettings {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'standard_price_uyu', type: 'int' }) standardPriceUyu: number;
  @Column({ name: 'standard_price_socio_uyu', type: 'int' }) standardPriceSocioUyu: number;
  @Column({ name: 'premium_price_uyu', type: 'int' }) premiumPriceUyu: number;
  @Column({ name: 'premium_price_socio_uyu', type: 'int' }) premiumPriceSocioUyu: number;
  @Column({ name: 'reset_session_price_uyu', type: 'int' }) resetSessionPriceUyu: number;
  @Column({ name: 'reset_session_price_socio_uyu', type: 'int' }) resetSessionPriceSocioUyu: number;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
```

No history/audit trail — overwriting the single row is sufficient (there's one admin account; tracking "who changed what" isn't a requirement).

`catalog.constants.ts`'s `PLANS`/`RESET_SESSION_PRICE` lose their price fields, keeping only what stays code-defined:

```ts
export const PLANS = {
  standard: { label: 'Standard Reset', sessionsPerMonth: 4 },
  premium: { label: 'Premium Reset', sessionsPerMonth: 8 },
} as const;
```

(`RESET_SESSION_PRICE` as a named export disappears entirely — nothing needs a price-less version of it.)

## Backend

New `PricingModule` (`server/src/pricing/`: entity, `PricingService`, `PricingController`, `UpdatePricingDto`), following the one-module-per-domain convention:

- `PricingService.getCurrent()`: returns the single `PricingSettings` row.
- `PricingService.update(dto)`: updates the single row's six price columns.
- `PUT /api/admin/pricing` — guarded by `JwtAuthGuard` (same guard as other admin routes). Body validated with `class-validator`: all six fields required, `@IsInt() @Min(1)`. Returns the updated settings.
- `GET /api/admin/pricing` — guarded, returns current settings (so the admin form has something to populate on load).

Two existing call sites switch from the static constants to `PricingService.getCurrent()`:

- `CatalogController.getConfig()` (`server/src/catalog/catalog.controller.ts`) — injects `PricingService`, adds a `pricing` field to the response:
  ```ts
  {
    slots, servicios,
    pricing: {
      standardPriceUyu, standardPriceSocioUyu,
      premiumPriceUyu, premiumPriceSocioUyu,
      resetSessionPriceUyu, resetSessionPriceSocioUyu,
    }
  }
  ```
  Still public, no guard — same as today.
- `PaymentsController` (`server/src/payments/payments.controller.ts`) — injects `PricingService`; `checkoutBooking` (line 60) and `checkoutSubscription` (lines 93-94) read `amount` from `PricingService.getCurrent()` instead of the static imports. This is the critical piece: it's what makes an admin price change actually change what MercadoPago charges, not just what the frontend displays.

`subscriptions.service.ts`'s use of `PLANS[params.plan].sessionsPerMonth` (line 56) is untouched — session counts aren't in scope.

## Frontend

- `BookingConfig` (`src/types/booking.types.ts`) gains a `pricing` field mirroring the new `/api/config` shape.
- `PaymentChoice/index.tsx` drops its hardcoded `RESET_SESSION_PRICE`/`PLAN_PRICES` mirror (lines 6-13) and instead receives pricing as a prop, threaded the same way `servicios` already is: `useBookingFlow` (already calling `useGetConfigQuery()`) passes `config.pricing` down through `BookingSection` to `PaymentChoice`.
- New admin page `AdminPricingPage` (`src/pages/AdminPricingPage/`), structured like `AdminUsersPage` (`AdminTopNav` + page content), linked from `AdminTopNav`.
- New `pricingApi.ts` (RTK Query, alongside the existing `*Api.ts` files): `useGetAdminPricingQuery` + `useUpdatePricingMutation`.
- Form built with `react-hook-form` + Zod, following `AdminLoginForm`'s pattern (`zodResolver`, `.unwrap()` inside try/catch, `extractApiErrorMessage` for error display) — six numeric inputs, Zod schema requiring positive integers.
- On successful save, invalidate `configApi`'s `getConfig` cache tag so the rest of the app (booking flow) picks up the new prices without a manual refresh.

## Migration

New migration (timestamp after `1785894700000`, the latest existing one) creates `pricing_settings` and seeds it with today's hardcoded values, so behavior is unchanged until someone edits it from the admin:

```sql
INSERT INTO pricing_settings (
  standard_price_uyu, standard_price_socio_uyu,
  premium_price_uyu, premium_price_socio_uyu,
  reset_session_price_uyu, reset_session_price_socio_uyu
) VALUES (2400, 1200, 3840, 1920, 600, 300);
```

## Error handling / edge cases

- **Invalid input** (negative/zero/non-integer price): rejected by `class-validator` at the DTO boundary with a Spanish, user-facing message (per the project's error-message convention) — never reaches the DB.
- **Race between reading price for display and an admin update**: not addressed — same tolerance as any other read-then-later-use flow in this app (e.g. availability slots can also change between page load and booking attempt). The existing MercadoPago checkout flow already re-derives the amount server-side at checkout time, so a customer never pays a stale client-side price; they'd only see a UI price that's a few seconds out of date until they refresh.
- **No row exists** (shouldn't happen post-migration, but defensively): `PricingService.getCurrent()` throws if the table is empty rather than silently falling back to hardcoded values — a missing row means the migration didn't run, which should surface loudly, not mask itself as "prices are still the old ones."

## Out of scope

- Editing `sessionsPerMonth` or plan `label` from the admin.
- Price history/audit trail.
- Per-user or promotional/coupon pricing beyond the existing flat socio discount.
- Any change to how `isSocio` is determined or applied.
