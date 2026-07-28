# MOVE® Recovery Room

Sitio y sistema de reservas del **Recovery Room by MOVE** — MOVE® Strength & Conditioning, Montevideo, Uruguay.

Landing con servicios, equipo y ubicación, reservas por bloques de 1 hora con confirmación por email, y un panel de administración para gestionar los turnos.

## Stack

| Pieza | Tecnología | Por qué |
|-------|-----------|---------|
| Front | HTML + CSS + JS vanilla | sin build step, carga instantánea |
| Backend | Vercel Serverless Functions | plan gratis, escala a cero |
| Base de datos | Neon (Postgres serverless) | plan gratis, driver HTTP sin pool |
| Emails | Brevo API | 300 mails/día gratis, sin dominio propio |

Sin frameworks ni bundler: se despliega tal cual está.

## Estructura

```
├─ index.html          # landing pública
├─ styles.css
├─ app.js              # lógica de reserva del front
├─ admin.html          # panel de reservas → /admin
├─ admin.css
├─ admin.js
├─ img/                # fotos del equipo
├─ api/
│  ├─ config.js        # GET  servicios y horarios disponibles
│  ├─ availability.js  # GET  slots libres/ocupados de una fecha
│  ├─ bookings.js      # POST crear · GET listar (admin) · DELETE cancelar (admin)
│  └─ diag.js          # GET  diagnóstico de configuración (admin)
├─ lib/
│  ├─ db.js            # conexión Neon + validaciones + constantes (SLOTS, SERVICIOS)
│  └─ mail.js          # cliente Brevo + plantillas de email
├─ vercel.json
├─ .env.example        # plantilla de variables de entorno
└─ DEPLOY.md           # guía de despliegue paso a paso
```

## Cómo funciona

**Reservar.** El front pide `/api/availability?date=…`, muestra los bloques libres y hace `POST /api/bookings`. La tabla tiene un `UNIQUE(date, time)`, así que dos personas no pueden quedarse con el mismo bloque: la segunda recibe un `409`.

**Emails.** Al confirmar salen dos mails: al cliente con el protocolo de la sesión y qué llevar, y al equipo con los datos de contacto. Si Brevo falla o falta la API key, **la reserva se guarda igual** y el error queda en los logs — el envío nunca bloquea la operación.

**Panel.** `/admin` pide la `ADMIN_KEY`, la guarda en `localStorage` y lista las reservas con métricas, búsqueda, filtros por período y servicio, orden por columna y cancelación (que libera el bloque y opcionalmente avisa al cliente).

## Puesta en marcha

Ver **[DEPLOY.md](DEPLOY.md)** para el paso a paso completo (Neon → Vercel → Brevo → variables de entorno).

Resumen:

```bash
npm install -g vercel
vercel login
vercel --prod
```

Y configurar en Vercel → Settings → Environment Variables las 6 variables de [`.env.example`](.env.example).

Para correr localmente:

```bash
npm install
cp .env.example .env   # completá los valores
vercel dev
```

## Diagnóstico

Si algo no funciona (típicamente los emails), `/api/diag?key=TU_ADMIN_KEY` reporta el estado de las variables de entorno, la conexión a Neon y la cuenta de Brevo — incluido si el remitente está verificado. Agregando `&test=tu@email.com` manda un mail de prueba. Nunca expone credenciales. Ver la sección de troubleshooting en [DEPLOY.md](DEPLOY.md).

## Personalizar

| Qué | Dónde |
|-----|-------|
| Horarios de los bloques | `lib/db.js` → `SLOTS` |
| Lista de servicios | `lib/db.js` → `SERVICIOS` |
| Texto del protocolo, qué llevar, contraindicaciones | `lib/mail.js` → `LLEVAR`, `PROTOCOLO`, `CUANDO_USAR`, `AVISOS` |
| Dirección del mapa | `index.html` → sección `#ubicacion` |
| Colores y tipografía | `styles.css` → `:root` |

## Notas

- La lista `AVISOS` (contraindicaciones) es un punto de partida y debe ser validada por un profesional antes de publicarse.
- La protección de `/admin` es la `ADMIN_KEY`: usá una clave larga y no la compartas por canales públicos. La página está marcada `noindex` y bloqueada en `robots.txt`.
- Los límites de los planes gratis: Brevo 300 mails/día (~150 reservas), y los de Vercel y Neon quedan lejos para este volumen.

---

Desarrollado por [SpaceDev](https://spacedev.io) para MOVE® Strength & Conditioning · [@move_strengthconditioning](https://www.instagram.com/move_strengthconditioning/)
