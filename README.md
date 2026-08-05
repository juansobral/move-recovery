# MOVE® Recovery Room

Sitio y sistema de reservas del **Recovery Room by MOVE** — MOVE® Strength & Conditioning, Montevideo, Uruguay.

Landing con servicios, equipo y ubicación, reservas por bloques de 1 hora con confirmación por email, y un panel de administración para gestionar los turnos.

## Stack

| Pieza | Tecnología | Por qué |
|-------|-----------|---------|
| Front | React + TypeScript (Vite) | Redux Toolkit / RTK Query, Tailwind + shadcn/ui, React Hook Form + Zod |
| Backend | NestJS empaquetado como una única Vercel Function | TypeORM + JWT/Passport, plan gratis, escala a cero |
| Base de datos | Neon (Postgres serverless) | plan gratis, migraciones de TypeORM |
| Emails | Brevo API | 300 mails/día gratis, sin dominio propio |

Todo el proyecto vive en un mismo repo y se despliega como un solo proyecto de Vercel: el front (`src/`) se sirve como estático, y `server/` se compila y corre detrás de una única función serverless (`api/index.js`).

## Estructura

```
├─ index.html, src/          # front — SPA de React (landing, reservas, /admin)
├─ public/                   # imágenes, robots.txt
├─ api/index.js              # única función serverless de Vercel
├─ server/                   # backend NestJS (workspace propio)
│  └─ src/
│     ├─ auth/               # JWT + Passport, entidad AdminUser, script de seed
│     ├─ bookings/           # entidad Booking, DTOs, servicio y controladores
│     ├─ catalog/            # SLOTS y SERVICIOS + GET /config
│     ├─ mail/                # cliente Brevo + plantillas + contenido editorial
│     ├─ diag/                # GET /diag (protegido)
│     └─ migrations/          # migraciones de TypeORM
├─ vercel.json
├─ .env.example               # plantilla de variables de entorno
└─ DEPLOY.md                  # guía de despliegue paso a paso
```

## Cómo funciona

**Reservar.** El front pide `GET /api/availability?date=…`, muestra los bloques libres y hace `POST /api/bookings`. La tabla `bookings` tiene un `UNIQUE(date, time)` a nivel de base de datos, así que dos personas no pueden quedarse con el mismo bloque: la segunda recibe un `409`.

**Emails.** Al confirmar salen dos mails: al cliente con el protocolo de la sesión y qué llevar, y al equipo con los datos de contacto. Si Brevo falla o falta la API key, **la reserva se guarda igual** y el error queda en los logs — el envío nunca bloquea la operación.

**Panel `/admin`.** Login con email + contraseña (JWT) — ya no es una clave compartida. Una vez adentro, lista las reservas con métricas, búsqueda, filtros por período y servicio, orden por columna y cancelación (que libera el bloque y opcionalmente avisa al cliente).

**Autenticación.** No hay alta de cuentas desde la app — la primera (y hasta ahora única) cuenta admin se crea con un script (ver más abajo).

## Puesta en marcha

Ver **[DEPLOY.md](DEPLOY.md)** para el paso a paso completo (Neon → Vercel → Brevo → variables de entorno → cuenta admin).

Para correr localmente:

```bash
npm install                # instala todo (front + server/, es un workspace de npm)
cp .env.example .env       # completá los valores
npm run dev:server         # NestJS en :3001
npm run dev                # Vite en :5173 (proxea /api a :3001)
npm run seed:admin --workspace=server   # crea la cuenta admin la primera vez
```

Para desplegar:

```bash
npm install -g vercel
vercel login
vercel --prod
```

## Diagnóstico

Si algo no funciona (típicamente los emails), el panel `/admin` tiene un botón "Diagnóstico" que reporta el estado de las variables de entorno, la conexión a Neon y la cuenta de Brevo — incluido si el remitente está verificado. Desde ahí también se puede mandar un mail de prueba. Nunca expone credenciales completas. Ver la sección de troubleshooting en [DEPLOY.md](DEPLOY.md).

## Personalizar

| Qué | Dónde |
|-----|-------|
| Horarios de los bloques | `server/src/catalog/catalog.constants.ts` → `SLOTS` |
| Lista de servicios | `server/src/catalog/catalog.constants.ts` → `SERVICIOS` |
| Texto del protocolo, qué llevar, contraindicaciones | `server/src/mail/mail-content.constants.ts` → `LLEVAR`, `PROTOCOLO`, `CUANDO_USAR`, `AVISOS` |
| Dirección del mapa | `src/components/landing/LocationSection/index.tsx` |
| Colores y tipografía | `src/styles/globals.css` (`:root`) y `tailwind.config.ts` |

## Notas

- La lista `AVISOS` (contraindicaciones) es un punto de partida y debe ser validada por un profesional antes de publicarse.
- `/admin` está protegido por login (JWT), marcado `noindex` y bloqueado en `robots.txt`.
- Los límites de los planes gratis: Brevo 300 mails/día (~150 reservas), y los de Vercel y Neon quedan lejos para este volumen.

---

Desarrollado por [SpaceDev](https://spacedev.io) para MOVE® Strength & Conditioning · [@move_strengthconditioning](https://www.instagram.com/move_strengthconditioning/)
