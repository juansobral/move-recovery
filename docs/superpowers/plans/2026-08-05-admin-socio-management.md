# Admin socio-management page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin see the list of customer accounts and manually flag which ones are "socios del club" (club members), so the upcoming discount-pricing logic has something to read.

**Architecture:** Two new admin-guarded endpoints on the existing `UsersModule` (reusing `UsersService`/`User` repository, no new module), and a new admin page consuming them via the existing admin `baseApi`/axios instance — nothing here touches the customer-facing auth realm.

**Tech Stack:** NestJS (existing), React + RTK Query (existing) — no new dependencies.

## Global Constraints

- This is the first of two plans from the same spec (`docs/superpowers/specs/2026-08-05-plans-mercadopago-payments-design.md`). The other (MercadoPago payments/subscriptions) is a separate, later plan — this plan does **not** show subscription/plan info on the users list, since that data model doesn't exist yet. Adding it later is a follow-up to this page, not a blocker for shipping it now.
- `isSocio` already exists on the `User` entity (added in the previous phase) — no migration needed.
- No automated tests for this plan — it's thin CRUD (list + one boolean toggle), verified via curl + a browser pass, consistent with how every other thin-wiring task in this project has been verified (only genuinely branching business logic gets unit tests here).
- Admin-guarded routes use the existing admin `JwtAuthGuard`/`AuthModule` — never the customer `UserJwtAuthGuard`. The two auth realms stay non-interchangeable, same as everywhere else in this codebase.

---

## File Structure

**Backend:**
```
server/src/users/dto/set-socio.dto.ts          (new)
server/src/users/admin-users.controller.ts     (new)
server/src/users/users.service.ts              (modify: add findAll, setSocio)
server/src/users/users.module.ts               (modify: register AdminUsersController, import AuthModule)
```

**Frontend:**
```
src/features/api/adminUsersApi.ts               (new)
src/features/api/baseApi.ts                     (modify: add 'AdminUser' tagType)
src/pages/AdminUsersPage/index.tsx               (new)
src/routes/router.tsx                            (modify: add /admin/usuarios route)
src/components/admin/AdminTopNav/index.tsx       (modify: add "Usuarios" nav link)
```

---

## Task 1: Backend — list customers + socio toggle

**Files:**
- Create: `server/src/users/dto/set-socio.dto.ts`
- Create: `server/src/users/admin-users.controller.ts`
- Modify: `server/src/users/users.service.ts`
- Modify: `server/src/users/users.module.ts`

**Interfaces:**
- Consumes: existing `User` entity, existing admin `JwtAuthGuard` (`server/src/auth/guards/jwt-auth.guard.ts`).
- Produces: `GET /api/admin/users` → `User[]`, `PATCH /api/admin/users/:id` → `User`. Used by Task 2's frontend.

- [ ] **Step 1: Add the DTO**

```ts
// server/src/users/dto/set-socio.dto.ts
import { IsBoolean } from 'class-validator';

export class SetSocioDto {
  @IsBoolean()
  isSocio: boolean;
}
```

- [ ] **Step 2: Add service methods**

In `server/src/users/users.service.ts`, add these two methods to the existing `UsersService` class (alongside `findById`/`completePhone`, no other changes to the file):

```ts
findAll(): Promise<User[]> {
  return this.usersRepo.find({ order: { createdAt: 'DESC' } });
}

async setSocio(id: string, isSocio: boolean): Promise<User> {
  const user = await this.usersRepo.findOneOrFail({ where: { id } });
  user.isSocio = isSocio;
  return this.usersRepo.save(user);
}
```

- [ ] **Step 3: Write the controller**

```ts
// server/src/users/admin-users.controller.ts
import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SetSocioDto } from './dto/set-socio.dto';
import { UsersService } from './users.service';

@Controller('admin/users')
@UseGuards(JwtAuthGuard)
export class AdminUsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  list() {
    return this.usersService.findAll();
  }

  @Patch(':id')
  setSocio(@Param('id') id: string, @Body() dto: SetSocioDto) {
    return this.usersService.setSocio(id, dto.isSocio);
  }
}
```

- [ ] **Step 4: Register in the module**

In `server/src/users/users.module.ts`, add the import and controller (the module already imports `TypeOrmModule.forFeature([User, Booking])`, `PassportModule`, `JwtModule.registerAsync(...)` — leave those as-is):

```ts
import { AuthModule } from '../auth/auth.module';
import { AdminUsersController } from './admin-users.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Booking]),
    PassportModule,
    JwtModule.registerAsync({ /* ...unchanged... */ }),
    AuthModule,
  ],
  controllers: [UsersController, AdminUsersController],
  providers: [UsersService, GoogleTokenVerifierService, googleOAuthClientProvider, UserJwtStrategy],
  exports: [JwtModule, PassportModule, UsersService],
})
export class UsersModule {}
```

(Only the `imports`/`controllers` arrays change — everything else in the file stays as it already is.)

- [ ] **Step 5: Manually verify**

Start the backend: `npm run dev:server`

```bash
# Without a token — expect 401
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/api/admin/users
```

Log in as admin (`POST /api/auth/login` with your seeded admin credentials) to get a token, then:

```bash
TOKEN="<paste the admin accessToken>"
curl -s http://localhost:3001/api/admin/users -H "Authorization: Bearer $TOKEN"
```
Expected: a JSON array of users (may be empty if none have logged in yet — if so, log in as a test customer via the frontend first, then re-run).

```bash
# Toggle isSocio for one user (replace <id> with a real id from the list above)
curl -s -X PATCH "http://localhost:3001/api/admin/users/<id>" \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"isSocio": true}'
```
Expected: `200` with the updated user object showing `"isSocio":true`.

```bash
# Confirm a customer token (not admin) is rejected
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/api/admin/users -H "Authorization: Bearer <a customer accessToken>"
```
Expected: `401` — proves the admin route doesn't accept customer tokens.

- [ ] **Step 6: Commit**

```bash
git add server/src/users/dto/set-socio.dto.ts server/src/users/admin-users.controller.ts server/src/users/users.service.ts server/src/users/users.module.ts
git commit -m "feat(server): admin endpoints to list customers and toggle socio status"
```

---

## Task 2: Frontend — admin Usuarios page

**Files:**
- Create: `src/features/api/adminUsersApi.ts`
- Modify: `src/features/api/baseApi.ts`
- Create: `src/pages/AdminUsersPage/index.tsx`
- Modify: `src/routes/router.tsx`
- Modify: `src/components/admin/AdminTopNav/index.tsx`

**Interfaces:**
- Consumes: `GET /api/admin/users`, `PATCH /api/admin/users/:id` (Task 1).
- Produces: `/admin/usuarios` route, reachable from `AdminTopNav`.

- [ ] **Step 1: Add the tag type**

In `src/features/api/baseApi.ts`, change:
```ts
tagTypes: ['Booking'],
```
to:
```ts
tagTypes: ['Booking', 'AdminUser'],
```
(No other change to this file.)

- [ ] **Step 2: Write the RTK Query API**

```ts
// src/features/api/adminUsersApi.ts
import { baseApi } from './baseApi';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  isSocio: boolean;
  createdAt: string;
}

export const adminUsersApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAdminUsers: builder.query<AdminUser[], void>({
      query: () => ({ url: '/admin/users', method: 'GET' }),
      providesTags: ['AdminUser'],
    }),
    setUserSocio: builder.mutation<AdminUser, { id: string; isSocio: boolean }>({
      query: ({ id, isSocio }) => ({ url: `/admin/users/${id}`, method: 'PATCH', data: { isSocio } }),
      invalidatesTags: ['AdminUser'],
    }),
  }),
});

export const { useGetAdminUsersQuery, useSetUserSocioMutation } = adminUsersApi;
```

- [ ] **Step 3: Write the page**

```tsx
// src/pages/AdminUsersPage/index.tsx
import { useMemo, useState } from 'react';
import { useGetAdminUsersQuery, useSetUserSocioMutation } from '../../features/api/adminUsersApi';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { Checkbox } from '../../components/ui/checkbox';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';

export const AdminUsersPage = (): JSX.Element => {
  useDocumentTitle('Usuarios · Admin · MOVE®');
  const { data: users = [], isFetching } = useGetAdminUsersQuery();
  const [setSocio] = useSetUserSocioMutation();
  const [q, setQ] = useState('');

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return users;
    return users.filter((u) => `${u.name} ${u.email} ${u.phone ?? ''}`.toLowerCase().includes(query));
  }, [users, q]);

  return (
    <div className="mx-auto max-w-site space-y-6 px-8 py-8 max-md:px-5">
      <h1 className="font-heading text-2xl uppercase tracking-wide">Usuarios</h1>

      <div className="max-w-sm">
        <Label htmlFor="users-search">Buscar</Label>
        <Input
          id="users-search"
          type="search"
          placeholder="Nombre, email o teléfono"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead className="border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-muted-foreground">Cliente</th>
              <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-muted-foreground">Contacto</th>
              <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-muted-foreground">Socio del club</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-b border-border last:border-b-0">
                <td className="px-4 py-3">{u.name}</td>
                <td className="px-4 py-3">
                  <div>{u.email}</div>
                  <div className="text-xs text-muted-foreground">{u.phone ?? '—'}</div>
                </td>
                <td className="px-4 py-3">
                  <Checkbox
                    checked={u.isSocio}
                    onCheckedChange={(checked) => setSocio({ id: u.id, isSocio: checked === true })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isFetching && rows.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">No hay usuarios para este filtro.</p>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Add the route**

In `src/routes/router.tsx`, add this block right after the existing `/admin` route (before `/completar-perfil`):

```tsx
{
  path: '/admin/usuarios',
  element: <RequireAuth />,
  children: [
    {
      index: true,
      lazy: async () => {
        const { AdminUsersPage } = await import('../pages/AdminUsersPage');
        return { Component: AdminUsersPage };
      },
    },
  ],
},
```

(`RequireAuth` — the admin guard — is already imported at the top of this file; no new import needed for it.)

- [ ] **Step 5: Add the nav link**

Replace `src/components/admin/AdminTopNav/index.tsx` in full:

```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { loggedOut } from '../../../features/auth/authSlice';
import { useAppDispatch } from '../../../store/hooks';
import { Button } from '../../ui/button';
import { DiagnosticsDialog } from '../DiagnosticsDialog';

interface AdminTopNavProps {
  onReload: () => void;
  isReloading: boolean;
}

export const AdminTopNav = ({ onReload, isReloading }: AdminTopNavProps): JSX.Element => {
  const dispatch = useAppDispatch();
  const [diagOpen, setDiagOpen] = useState(false);

  return (
    <header className="flex items-center justify-between border-b border-border px-8 py-4 max-md:px-5">
      <div className="flex items-center gap-3">
        <Link to="/" className="font-heading text-2xl font-black tracking-[2px]">
          MOVE<span className="align-super text-xs font-semibold">®</span>
        </Link>
        <span className="rounded-md border border-border px-2 py-0.5 text-xs uppercase tracking-wide text-muted-foreground">Admin</span>
      </div>
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin/usuarios">Usuarios</Link>
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setDiagOpen(true)}>
          Diagnóstico
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onReload} disabled={isReloading}>
          {isReloading ? '…' : 'Actualizar'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => dispatch(loggedOut())}>
          Salir
        </Button>
      </div>
      <DiagnosticsDialog open={diagOpen} onOpenChange={setDiagOpen} />
    </header>
  );
};
```

- [ ] **Step 6: Verify and commit**

Run `npx tsc -b --noEmit` (expect exit 0) and `npm run build` (expect success) from the repo root.

Then, with the backend running (`npm run dev:server`) and the frontend running (`npm run dev`): log in to `/admin`, click "Usuarios" in the top nav, confirm the customer list loads, search for a known customer, toggle their "Socio del club" checkbox, and confirm it persists after a page reload (re-fetching the list).

```bash
git add src/features/api/adminUsersApi.ts src/features/api/baseApi.ts src/pages/AdminUsersPage src/routes/router.tsx src/components/admin/AdminTopNav/index.tsx
git commit -m "feat(web): admin usuarios page with socio toggle"
```

---

## Self-Review Notes

- **Spec coverage:** this plan implements exactly the "admin socio-management" slice of the spec — customer list + `isSocio` toggle. The "current plan/status" column explicitly deferred to the MercadoPago plan, per this plan's own Global Constraints, matching the spec's phased approach.
- **No circular module dependency:** `UsersModule` now imports `AuthModule` (for the admin guard), mirroring the already-working precedent in `BookingsModule` (which imports both `AuthModule` and `UsersModule`). `AuthModule` imports neither `UsersModule` nor `BookingsModule`, so no cycle is introduced.
- **Placeholder scan:** none found — every step has complete, concrete code.
