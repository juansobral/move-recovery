# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Sitio y sistema de reservas del **Recovery Room by MOVE** (MOVE® Strength & Conditioning, Montevideo). Landing + reservas por bloques de 1 hora con confirmación por email + panel de administración.

**Stack de la empresa (SpaceDev): NestJS + TypeScript + PostgreSQL/TypeORM en el back, React + TypeScript + Redux Toolkit en el front.** Este repo empezó como un sitio 100% estático sin build step (ver historial de git) y fue reescrito por completo para conformar al stack estándar de la empresa — la landing, el widget de reservas y el panel admin son ahora una sola SPA de React, y el backend es NestJS empaquetado como **una única función serverless de Vercel** (no un servidor siempre activo).

## Comandos

```bash
npm install                 # instala TODO (workspaces: raíz + server/)
npm run dev                 # Vite dev server (front) — localhost:5173, proxea /api a :3001
npm run dev:server          # NestJS en watch mode — localhost:3001/api
npm run build               # build completo: server (nest build) + front (vite build) — el mismo comando que corre Vercel
```

Backend (dentro de `server/`, o con `--workspace=server` desde la raíz):

```bash
npm run migration:generate --workspace=server   # generar migración a partir de cambios en las entidades
npm run migration:run --workspace=server        # aplicar migraciones pendientes
npm run migration:revert --workspace=server     # revertir la última migración
npm run seed:admin --workspace=server           # crear/actualizar la cuenta admin (lee SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD)
```

No hay lint ni test runner configurados. Antes de developear, copiar `.env.example` a `.env` y completar los valores (ver DEPLOY.md) — un solo `.env` en la raíz sirve tanto al front (Vite) como al back (`server/`, que lo resuelve dos niveles arriba de `src/`).

Para probar el wiring real de Vercel (la función serverless única, los rewrites de `vercel.json`) hace falta `vercel dev` — pero como reutiliza la configuración del proyecto ya linkeado, cualquier prueba así toca credenciales reales si el ambiente "Development" del proyecto en Vercel llega a tenerlas configuradas. Preferir probar contra una base de datos descartable.

## Arquitectura

```
index.html + src/                  → SPA de Vite/React (landing + reservas + /admin)
  src/pages/                         LandingPage, AdminLoginPage, AdminDashboardPage, NotFoundPage
  src/components/{landing,booking,admin,layout,ui}
  src/features/{auth,api}           Redux Toolkit: authSlice + RTK Query (config/availability/bookings/auth/diag)
  src/hooks/                        useBookingFlow, useBookingFilters, useAnchorScroll, ...
  src/schemas/                      Zod — mirror en el cliente de las reglas de server/src/bookings/dto (mismos mensajes en español)
api/index.js                       → ÚNICA función serverless de Vercel; hace bootstrap() de Nest una vez por contenedor "tibio" y reutiliza esa instancia
server/                            → backend NestJS (workspace propio, su propio package.json/tsconfig)
  src/auth/                          JWT + Passport, entidad AdminUser, seed script (no hay alta de usuarios en la app)
  src/bookings/                      entidad Booking, DTOs (class-validator), BookingsService, BookingsController + AvailabilityController
  src/catalog/                       SLOTS/SERVICIOS (constantes de código, no vienen de la DB) + GET /config público
  src/mail/                          MailService — puerto casi literal del mail.js original; contenido editorial en mail-content.constants.ts
  src/diag/                          GET /diag, protegido con JwtAuthGuard (antes era ADMIN_KEY)
  src/migrations/                    migraciones de TypeORM — nunca alterar el esquema a mano
  src/bootstrap.ts / main.ts         bootstrap.ts lo usa api/index.js (serverless); main.ts es solo para `nest start` local
```

**Por qué una función serverless en vez de un server NestJS normal:** Vercel Node Functions ya entregan un `(req, res)` real — `api/index.js` arranca Nest sobre una instancia de Express propia (`ExpressAdapter`) y la cachea en el módulo, sin usar `serverless-http`/`@codegenie/serverless-express` (esos adaptadores traducen eventos de Lambda, que acá no existen). **`module.exports.config = { api: { bodyParser: false } }` es crítico**: si Vercel parsea el body además de Nest, el segundo intento lee un stream ya vacío y todo `POST`/`DELETE` se rompe en silencio.

**El error `{ error: '<mensaje>' }` es el único formato que el front sabe leer.** `server/src/common/filters/http-exception.filter.ts` reformatea toda excepción HTTP a ese shape — sin este filtro, los defaults de Nest devuelven `error` como la frase HTTP ("Bad Request") en vez del mensaje real, y el front mostraría eso en vez de "Email inválido." Al agregar una ruta nueva, cualquier excepción lanzada (`BadRequestException`, `ConflictException`, etc.) ya pasa por este filtro automáticamente — no hay que hacer nada especial, pero si algo devuelve un error "genérico" en el front, es la primera sospecha.

**`UNIQUE(date, time)` sigue siendo una restricción real de la DB** (migración `CreateBookings`), no solo una validación de DTO — es lo que hace atómico el 409 en reservas simultáneas al mismo bloque. `BookingsService.create()` traduce `23505`/`23P01` a `ConflictException`.

**Reservas se borran físicamente al cancelar (hard delete), no soft-delete** — a propósito: cancelar tiene que liberar el bloque al instante, y un soft-delete necesitaría un índice único parcial para lograr lo mismo. Si en algún momento se pide un historial de cancelaciones, ese es el punto a revisar.

**Autorización admin es JWT ahora, no un string compare.** Reemplaza al viejo `ADMIN_KEY` (que además tenía un fallback inseguro `'move-admin'`). No hay alta de usuarios desde la app — la única cuenta admin se crea con `npm run seed:admin --workspace=server` (lee `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`). El login siempre devuelve el mismo error genérico ("Credenciales inválidas.") sin distinguir email inexistente de clave incorrecta.

**Emails nunca bloquean una reserva.** `MailService.enviar()` usa `Promise.allSettled` igual que el original; si Brevo falla o falta `BREVO_API_KEY`, se loguea (prefijo `[mail]`) pero la reserva ya insertada se devuelve igual como éxito — y ojo, esto significa que `emailSent: true` en la respuesta **no garantiza que el mail se haya mandado de verdad** si falta la API key (comportamiento heredado del código original, no un bug). Al tocar `BookingsService.create`, preservar el orden: insert primero, mail después con su propio manejo de error.

**`SLOTS` y `SERVICIOS`** (`server/src/catalog/catalog.constants.ts`) son la única fuente de verdad de horarios y servicios en el backend — el front los mirror-ea en `src/schemas/booking.schema.ts` solo para tipado/fallback, pero en runtime siempre los pide a `GET /api/config`. Si se cambian los horarios, hay que tocar ambos lugares (o aceptar que el fallback del front quede desactualizado hasta el próximo deploy).

**Contenido editorial de los emails** (qué llevar, protocolo, cuándo usar, contraindicaciones) vive en `server/src/mail/mail-content.constants.ts` (`LLEVAR`, `PROTOCOLO`, `CUANDO_USAR`, `AVISOS`) — cambios de texto van ahí, no en las plantillas HTML de `mail.service.ts`.

**`GET /api/diag`** (protegido) reporta env vars/conexión a Neon/estado de Brevo sin exponer credenciales completas — mismo patrón de siempre (`pista()` trunca). Si se agregan env vars nuevas relevantes al deploy, sumarlas ahí siguiendo el mismo patrón.

## Convenciones de este repo

- Backend: TypeScript strict (con `strictPropertyInitialization: false` — necesario para que entidades TypeORM y DTOs de class-validator compilen sin inicializadores; es el patrón estándar de Nest+TypeORM, no una relajación general), Controller → Service → Repository, DTOs con `class-validator`, `ConfigService` para toda env var (nunca `process.env` directo en servicios).
- Frontend: componentes funcionales, **named exports únicamente** (las rutas usan `route.lazy()` de React Router en vez de `React.lazy()` para no necesitar default exports), archivos co-ubicados `ComponentName/index.tsx`, sin lógica de negocio dentro de componentes (va en hooks/`lib`).
- Los mensajes de error, el contenido de los emails y los comentarios están en **español** (rioplatense) — mantener el idioma al editar `server/src/mail/`, DTOs, y mensajes de error de la API.
- Los mensajes de error que devuelven las APIs son user-facing (se muestran tal cual en el front) — deben ser claros y en español, no términos técnicos internos.
