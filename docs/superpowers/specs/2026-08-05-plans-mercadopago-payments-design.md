# Plans + MercadoPago payments — design

## Context

This is the third sub-project of the larger customer-facing feature set (user accounts + Google login shipped and merged; this covers the remaining two originally-planned sub-projects together, at the user's request):

1. ~~User accounts + Google login~~ — done, merged (`docs/superpowers/specs/2026-08-04-user-accounts-google-login-design.md`).
2. ~~Profile area~~ — largely delivered as part of (1); "mi cuenta" already shows a plan placeholder and the customer's own bookings.
3. **Plans + MercadoPago payments** (this spec) — pricing, checkout, subscriptions, webhooks, session-credit tracking, and the booking-flow changes that consume them.
4. **Admin-managed "socio del club" flag** (folded into this spec) — the `isSocio` column already exists on `User` (added in phase 1); this spec adds the admin UI to manage it and the pricing logic that reads it.

Everything here was decided through direct discussion with the user (pricing, session counts, discount scope, checkout style, credit rollover, cancellation timing, slot-during-payment handling, and the post-subscribe auto-booking behavior) — this section is the record of those decisions, not open questions.

## Plans

Three fixed offerings, defined as code constants (same pattern as the existing `SLOTS`/`SERVICIOS` in `catalog.constants.ts` — not a database table, since these change rarely and a deploy is an acceptable way to change pricing):

| Plan | Price (socio price) | Sessions/month | Billing |
|---|---|---|---|
| Standard Reset | $2400 ($1200) | 4 | Monthly subscription |
| Premium Reset | $3840 ($1920) | 8 | Monthly subscription |
| Reset Session | $600 ($300) | 1 (single use) | One-off payment |

The 50% socio discount applies to all three. Session credits **do not roll over** — each billing cycle grants a fresh allotment, unused credits are lost. If a subscriber runs out of credits before their cycle renews, they can pay the Reset Session price (discounted if they're a socio) for one additional booking, same as a non-subscriber.

## Checkout style: MercadoPago Checkout Pro (hosted redirect)

Both the one-off payment and the subscription use MercadoPago's hosted redirect checkout — the customer is sent to a MercadoPago-hosted page to enter payment details and is redirected back afterward. No card data ever touches our frontend or backend. This is simpler to build and reason about than an embedded card-entry component, and it's the natural fit for MercadoPago's Preapproval (subscription) API, which is redirect-based by design.

Subscriptions are created **ad-hoc** via `POST /preapproval` with the price computed in our own code from `user.isSocio` at signup time — not via MercadoPago's `preapproval_plan` pre-registration feature. This keeps all pricing/discount logic in one place (our code) instead of needing four parallel plan objects registered on MercadoPago's side (Standard, Standard+socio, Premium, Premium+socio).

## Data model

```ts
// server/src/subscriptions/entities/subscription.entity.ts
@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'user_id', type: 'uuid' }) userId: string;
  @ManyToOne(() => User) @JoinColumn({ name: 'user_id' }) user: User;

  @Column({ type: 'text' }) plan: 'standard' | 'premium';
  @Column({ name: 'mp_preapproval_id', type: 'text', unique: true }) mpPreapprovalId: string;
  @Column({ type: 'text' }) status: 'authorized' | 'cancelled'; // MercadoPago-side billing status, not an access check

  @Column({ name: 'current_period_start', type: 'date' }) currentPeriodStart: string;
  @Column({ name: 'current_period_end', type: 'date' }) currentPeriodEnd: string;
  @Column({ name: 'session_credits_remaining', type: 'int' }) sessionCreditsRemaining: number;
  @Column({ name: 'session_credits_total', type: 'int' }) sessionCreditsTotal: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
```

`Booking` gains one nullable column: `mpPaymentId: string | null` — set only for one-off paid bookings, so the admin view can distinguish "paid per-session" from "covered by a subscription" at a glance. No other change to `Booking`.

A customer can accumulate multiple `Subscription` rows over their lifetime (subscribe, cancel, resubscribe later, switch plans) — there is no update-in-place or single-row-per-user constraint. "The customer's current subscription" is always resolved as: the most recent row (`ORDER BY created_at DESC`) whose `currentPeriodEnd >= today`. If none qualifies, the customer has no active plan, matching today's "Sin plan activo" state. `GET /api/subscriptions/me` and the booking-time credit check both use this same resolution rule.

**The access check is a pure date/count comparison, not a status check:** a customer can book without paying if `subscription.currentPeriodEnd >= today AND subscription.sessionCreditsRemaining > 0`, regardless of whether `status` is `'authorized'` or `'cancelled'`. This is what makes "cancel now, keep access until the paid period ends" work with zero extra machinery: cancelling calls MercadoPago's cancel API immediately (stops future billing) and marks our own row `status: 'cancelled'`, but the date/count check keeps honoring the period the customer already paid for. No cron job, no interception of MercadoPago's billing cycle needed.

## Backend API

New `PaymentsModule` (checkout + webhook) and `SubscriptionsModule` (`server/src/payments/`, `server/src/subscriptions/`):

- `POST /api/bookings/checkout` — guarded (customer). Body: `{ date, time, service?, notes? }`. If the customer has usable credits (per the access check above), behaves exactly like today's `POST /api/bookings` (decrements `sessionCreditsRemaining` by 1, creates the booking, returns the same response shape). If not, creates a MercadoPago Checkout Pro preference for the Reset Session price (halved if `isSocio`), with the booking intent (date/time/service/notes, **not including free-text notes longer than a short cap** — see Error Handling) signed and embedded in `external_reference`. Returns `{ initPoint: string }` for the frontend to redirect to. This replaces `POST /api/bookings` as the customer-facing booking endpoint going forward (the old endpoint's guard/logic move here; `POST /api/bookings` itself can be removed).
- `POST /api/subscriptions/checkout` — guarded (customer). Body: `{ plan: 'standard' | 'premium', intendedBooking?: { date, time, service?, notes? } }`. Creates a MercadoPago preapproval via `POST /preapproval` with `auto_recurring.transaction_amount` computed from the plan + `isSocio`, the intended booking (if present) signed into `external_reference` alongside the plan choice. Returns `{ initPoint: string }`.
- `POST /api/payments/webhook` — **public**, no JWT guard (MercadoPago calls this directly) — but validates MercadoPago's webhook signature (`x-signature`/`x-request-id` headers, HMAC-SHA256 against a `MP_WEBHOOK_SECRET`) before trusting anything in the body. Handles two topics:
  - `payment`: fetch the payment via MercadoPago's Payments API using the ID in the notification, confirm `status === 'approved'`, decode+verify the signed `external_reference`, then attempt to create the booking (same unique-slot-constraint path as always). If the slot is now taken, refund the payment via MercadoPago's refund API and do not create a booking.
  - `preapproval`: on `authorized`, decode+verify `external_reference` for the chosen plan (+ optional intended booking), create/update the `Subscription` row (fresh `sessionCreditsRemaining`/`currentPeriodEnd` for a new cycle, or full-total reset for a renewal charge event), then — if an intended booking was carried along — attempt to create it using the now-available credit. If that slot is taken, the subscription still stands; the customer just needs to pick another slot (no error surfaced through the webhook path — the frontend's polling will show "no se pudo reservar ese horario, elegí otro" and route them back to the normal, now-free booking flow).
- `GET /api/bookings/checkout-status?ref=<reference>` — guarded (customer). Polled by the frontend after returning from MercadoPago's redirect; reports whether the referenced checkout resolved to a created booking, a still-pending webhook, or a failure/refund.
- `GET /api/subscriptions/me` — guarded (customer). Returns the caller's current subscription (or `null`), consumed by both the "mi cuenta" plan card (replacing today's placeholder) and the booking flow's credit check.
- `DELETE /api/subscriptions/me` — guarded (customer). Calls MercadoPago's preapproval-cancel endpoint, sets `status: 'cancelled'` locally. Per the access-check design above, this does not touch `currentPeriodEnd`/`sessionCreditsRemaining` — the customer keeps using their already-paid period normally.
- `PATCH /api/admin/users/:id` — guarded (admin). Body: `{ isSocio: boolean }`. The only mutation the new admin "Usuarios" page needs.
- `GET /api/admin/users` — guarded (admin). Lists all customers (name, email, phone, `isSocio`, current plan/status if subscribed) for the new admin page.

## Frontend

- Booking flow: when the customer has no usable credits, the existing "Confirmar reserva" button is replaced by two options — "Pagar $X" (one-off) and "Suscribirme a Standard/Premium ($Y/mes)" — each calling its respective `/checkout` endpoint and redirecting (`window.location.assign(initPoint)`) on success.
- A new `/pago-pendiente` (or similar) route the MercadoPago redirect lands on, which polls `checkout-status` and shows a spinner → success/failure state, then routes to `/mi-cuenta` or back to the booking section as appropriate.
- "Mi cuenta" page: the existing "Sin plan activo todavía" placeholder is replaced with real data from `GET /api/subscriptions/me` (plan name, sessions remaining/total, renewal date, a "cancelar suscripción" button calling the `DELETE` endpoint with a confirmation dialog — this is the one place in the whole customer-facing app where a destructive customer-initiated action exists, so it gets the same confirm-dialog treatment as the admin's booking-cancel flow).
- New admin page `/admin/usuarios` (linked from the existing `AdminTopNav`): a table (same search/filter shell as the existing bookings admin) listing customers with an `isSocio` toggle and their current plan/status.

## Error handling / edge cases

- **Webhook forgery:** every webhook call is signature-verified before any state change; an invalid signature is rejected with `401` and nothing is trusted from the body.
- **`external_reference` tampering:** the booking-intent payload embedded in `external_reference` is signed (HMAC, same style as the webhook signature) so a customer can't edit the redirect URL or intercept the preference-creation response to get a cheaper session, a different slot, or someone else's booking created under their payment.
- **Free-text notes in the payment flow:** `notes` is capped to a short length (e.g. 200 characters) when carried through `external_reference`, to stay well within MercadoPago's field size limits — this is more restrictive than the uncapped `notes` field on direct (credit-covered) bookings, called out explicitly as an intentional, minor UX difference rather than a bug.
- **Slot race during one-off payment:** refund + no booking, as described above.
- **Slot race after subscription confirms:** subscription stands, booking simply doesn't auto-complete; customer picks again with their new credit.
- **Recurring charge failure (e.g. subscriber's card is declined on renewal):** MercadoPago's `preapproval` webhook reports the failure; we do not extend `currentPeriodEnd`/reset credits, so the access check naturally stops granting free bookings once the previous period's end date passes — no separate "suspend" step needed.

## Out of scope for this spec

- Any change to the one-off Reset Session flow for a **socio who is also a subscriber** stacking discounts, or any other promotional/coupon logic beyond the flat 50% socio discount.
- Refund/dispute handling beyond the two specific cases named above (slot race, recurring failure).
- Historical/analytics reporting on plan revenue — the admin "Usuarios" page is management (toggle socio status), not a reporting dashboard.
