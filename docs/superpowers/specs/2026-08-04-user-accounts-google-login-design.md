# User accounts + Google login — design

## Context

This is the first of several sub-projects toward a larger feature set: customer accounts, subscription plans, MercadoPago payments, admin-managed membership discounts, and booking-flow changes to skip payment when a plan covers the session. That larger feature was decomposed into independent sub-projects because it spans multiple subsystems that don't need to be designed together:

1. **User accounts + Google login** (this spec) — foundational, blocks everything else.
2. Profile area (plan status, booking history) — builds on (1).
3. MercadoPago integration (one-off payments + subscriptions, webhooks, session-credit tracking).
4. Admin-managed "socio del club" flag + discount pricing.
5. Booking-flow changes to check plan/credits before requiring payment.

Decisions made for the overall feature, ahead of this spec:
- **Login required to book, going forward.** The public site no longer allows anonymous booking; every reservation is now tied to a logged-in customer.
- **Customer accounts (`users`) and admin accounts (`admin_users`) stay as two completely separate tables/auth systems.** No shared "role" concept — matches how distinct these two audiences already are in the app (different login UI, different guards, different tokens).
- **Google-only login for customers.** No email/password path for customers (admin login is unaffected and stays email/password).
- **Booking form pulls name/email from the Google account; phone is collected once and reused.** The booking form shrinks to service/date/time/notes once a user has completed their profile.
- **Phone is collected via a one-time "complete your profile" gate immediately after first login**, before the user can do anything else (book, view profile, etc.).

## Architecture: Google Identity Services + our own JWT

The frontend uses Google's client-side "Sign in with Google" button (Google Identity Services), which returns a signed ID token to the browser without leaving the page. The backend verifies that ID token against Google's public keys (via `google-auth-library`), upserts a `User` row, and issues our own JWT — signed with a **separate secret** (`USER_JWT_SECRET`) from the admin JWT (`JWT_SECRET`), with its own strategy/guard pair, so a customer token can never pass the admin guard or vice versa.

Rejected alternative: a full server-side OAuth2 redirect flow (Passport's `google-oauth20` strategy). More "textbook" OAuth2, but clunkier in an SPA (full-page navigation away and back, redirect-URI management across dev/prod environments) and doesn't reuse the JWT/guard/RTK-Query patterns already built for admin auth as cleanly. Not worth the extra complexity for a single provider.

## Data model

New, independent `users` module in `server/src/users/` (parallel to `server/src/auth/`, does not touch `AdminUser`):

```ts
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ unique: true }) googleId: string;
  @Column({ unique: true }) email: string;
  @Column() name: string;
  @Column({ type: 'text', nullable: true }) phone: string | null;
  @Column({ type: 'text', nullable: true }) avatarUrl: string | null;
  @Column({ default: false }) isSocio: boolean;   // manual admin flag, used by a later phase for discount pricing
  @CreateDateColumn() createdAt: Date;
}
```

`Booking` gets one new column: `userId` (FK → `users.id`, set on every booking going forward). The existing `name`/`email`/`phone` columns on `Booking` are **kept as-is** — they're populated from the user's profile at booking time and act as a point-in-time snapshot, so a later profile change doesn't rewrite booking history. This matches the existing denormalized-snapshot pattern already used elsewhere in the app (e.g. `service` on `Booking` is a snapshot, not a live FK to a services table).

A TypeORM migration adds the `users` table and the `bookings.user_id` column + FK constraint.

## Backend API

All under a new `UsersModule` (`server/src/users/`):

- `POST /api/users/auth/google` — **public**. Body: `{ idToken: string }`. Verifies the token, upserts `User` by `googleId` (falling back to matching by `email` on first login in case `googleId` wasn't captured yet — defensive, shouldn't normally happen), returns `{ accessToken: string, profileComplete: boolean }` where `profileComplete = phone !== null`.
- `GET /api/users/me` — guarded by `UserJwtAuthGuard`. Returns the current profile.
- `PATCH /api/users/me` — guarded. Body: `{ phone: string }` (validated, same min-length rule as the existing booking phone field). Used once, by the profile-completion screen.
- `GET /api/users/me/bookings` — guarded. Returns only the caller's own bookings, split into upcoming/past using the same date-comparison logic already used in the admin dashboard's stats.

`UserJwtStrategy`/`UserJwtAuthGuard` are structurally identical to the existing admin `JwtStrategy`/`JwtAuthGuard`, just pointed at `USER_JWT_SECRET` and a `User` lookup instead of `AdminUser`.

**Booking creation changes:** `POST /api/bookings` (currently public) becomes guarded by `UserJwtAuthGuard`. The DTO drops `name`/`email`/`phone` as client-supplied fields (they're now populated server-side from the authenticated user's profile); the service still writes them onto the `Booking` row as a snapshot, plus sets `userId`.

## Frontend flow

- New Redux slice + RTK Query endpoints for customer auth, entirely separate from the admin `authSlice`/`authApi` — both can hold independent sessions at once (e.g. an admin testing the customer flow in the same browser).
- Landing page booking section is gated: logged-out visitors see "Iniciá sesión con Google para reservar" in place of the form; the Google Sign-In button lives there.
- On first login, if `profileComplete` is `false`, the user is routed to a one-time `/completar-perfil` screen (just a phone field) before reaching anything else.
- New protected route `/mi-cuenta`: shows plan status (placeholder "Sin plan activo" — real data arrives with the MercadoPago phase) and two lists of the user's own bookings (próximas / pasadas), **read-only** in this phase — no self-service booking cancellation yet (only subscription cancellation was requested, and that doesn't exist until the MercadoPago phase; individual booking cancellation by customers is out of scope unless requested later).
- Booking form shrinks to service + date/time + notes; name/email/phone are no longer user-editable fields on this form.

## Error handling

- Invalid, expired, or malformed Google ID token → `401` with a Spanish message, same `{ error: string }` shape used everywhere else in the API.
- `PATCH /api/users/me` with an invalid phone → `400`, same validation message style as the existing booking phone field.
- `POST /api/bookings` without a valid user token → `401` (the frontend never renders a submittable form for logged-out users, but the backend enforces it regardless).

## Testing/verification

Same approach as the rest of this project: curl-level testing of every new endpoint (valid Google token via a manual test account, missing/garbage token, profile completion, scoped bookings list, booking creation now requiring auth), then a real browser pass (log in, complete profile, book, see it show up under "mi cuenta").

## Out of scope for this spec

- Plan/subscription data (phase 3) — profile shows a placeholder only.
- MercadoPago payment/checkout (phase 3).
- Admin "socio del club" management UI (phase 4) — the `isSocio` column exists on `User` now so the schema doesn't need revisiting later, but there's no admin UI to set it yet.
- Self-service booking cancellation by customers (not requested; only subscription cancellation was).
