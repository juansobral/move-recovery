# Deploy en Vercel + Neon — MOVE Recovery Room

Guía paso a paso para dejar el sitio online con una URL pública y reservas que se guardan de verdad.

Estructura del proyecto (ya lista):

```
move-recovery-vercel/
├─ index.html, src/       # front (React + Vite): landing, reservas, /admin
├─ public/                # imágenes, robots.txt
├─ api/index.js           # única función serverless de Vercel
├─ server/                # backend NestJS (workspace propio)
│  └─ src/
│     ├─ auth/            # login (JWT) + script de seed de la cuenta admin
│     ├─ bookings/        # reservas (crear, listar, cancelar)
│     ├─ catalog/         # horarios y servicios
│     ├─ mail/            # envío de emails + plantillas
│     └─ migrations/      # migraciones de TypeORM
├─ vercel.json
└─ package.json
```

---

## Paso 1 — Crear la base de datos (Neon, gratis)

1. Entrá a https://neon.tech y creá una cuenta (podés usar tu cuenta de GitHub o Google).
2. Creá un proyecto nuevo (botón "Create project"). Elegí la región más cercana (por ejemplo *AWS us-east* o *sa-east* si aparece).
3. Al crearlo te muestra una **Connection string** parecida a esto:

   ```
   postgresql://usuario:clave@ep-xxxx-pooler.region.aws.neon.tech/neondb?sslmode=require
   ```

4. Copiala y guardala: la vas a pegar en Vercel en el Paso 3. Usá la versión **"Pooled connection"** si te da a elegir.

> A diferencia de la versión anterior del sitio, acá **sí hace falta correr las migraciones** una vez (Paso 5) — la tabla ya no se crea sola en el primer request.

---

## Paso 2 — Subir el proyecto a Vercel

En la Terminal, parado dentro de la carpeta `move-recovery-vercel`:

```bash
npm install -g vercel   # instala la herramienta de Vercel (una sola vez)
vercel login            # te abre el navegador para iniciar sesión
vercel                  # primer deploy (respondé Enter a todo)
```

Cuando termine te da una URL de preview. Para la versión pública final:

```bash
vercel --prod
```

Vercel corre `npm run build` (compila el backend en `server/` con `nest build` y el front con `vite build`) y sirve `dist/` como estático, con `api/index.js` como la única función serverless detrás de `/api/*`. Si el proyecto ya estaba vinculado a Vercel desde antes, revisá en **Settings → Build & Development Settings** que no haya un Framework Preset o comandos guardados de la versión vieja (estática) del sitio — con este repo alcanza con los defaults + lo que ya está en `vercel.json`.

---

## Paso 3 — Configurar los emails (Brevo, gratis)

Usamos **Brevo** porque el plan gratis permite **300 emails por día para siempre** y no hace falta tener un dominio propio: alcanza con verificar la casilla de Gmail como remitente.

1. Creá una cuenta en https://www.brevo.com (plan Free, sin tarjeta).
2. **Verificá el remitente.** Andá a **Settings → Senders, Domains & Dedicated IPs → Senders → Add a sender** y agregá `movesc.performance@gmail.com`. Brevo manda un mail de confirmación a esa casilla: abrilo y confirmá. Sin este paso los envíos fallan.
3. **Generá la API key.** Andá a **Settings → SMTP & API → API keys → Generate a new API key**. Copiala completa (empieza con `xkeysib-`); solo se muestra una vez.

> Ojo: la *API key* y la *SMTP key* son credenciales distintas. Necesitás la **API key**.

---

## Paso 4 — Variables de entorno

En Vercel, entrá a tu proyecto → **Settings → Environment Variables** y agregá:

| Name | Value | Para qué sirve |
|------|-------|----------------|
| `DATABASE_URL` | la connection string de Neon del Paso 1 | guardar las reservas |
| `JWT_SECRET` | una clave inventada por vos, larga y aleatoria | firmar las sesiones de `/admin` |
| `BREVO_API_KEY` | la API key del Paso 3 (`xkeysib-…`) | enviar los emails |
| `MAIL_FROM` | `movesc.performance@gmail.com` | remitente (tiene que ser el verificado en Brevo) |
| `MAIL_ADMIN` | `movesc.performance@gmail.com` | a dónde llega el aviso de nueva reserva |
| `SITE_URL` | la URL pública, ej. `https://move-recovery.vercel.app` (sin `/` al final) | links dentro de los emails |
| `GOOGLE_CLIENT_ID` | el Client ID de un "OAuth 2.0 Client ID" tipo Web application en Google Cloud Console | verificar el idToken de Google en el login de clientes |
| `USER_JWT_SECRET` | una clave inventada por vos, larga y aleatoria (separada de `JWT_SECRET` a propósito — los dos tipos de token nunca deben ser intercambiables) | firmar las sesiones de clientes (`/mi-cuenta`, reservas) |
| `MP_ACCESS_TOKEN` | el access token de tu aplicación en MercadoPago | procesar pagos con MercadoPago |
| `MP_WEBHOOK_SECRET` | la clave secreta para validar webhooks de MercadoPago | autenticar notificaciones de pago desde MercadoPago |
| `VITE_GOOGLE_CLIENT_ID` | el mismo valor que `GOOGLE_CLIENT_ID` (los Client ID de Google no son secretos, están pensados para ir en código de cliente) | mostrar el botón de Google Sign-In en el front |

> `VITE_GOOGLE_CLIENT_ID` se incorpora al bundle del front **en tiempo de build** (Vite la reemplaza al compilar) — a diferencia de las variables server-only de arriba, que se leen en runtime, esta tiene que estar configurada en Vercel *antes* de correr `vercel --prod` / `npm run build`. Si la cambiás después, hace falta un nuevo build para que tome efecto.

Marcá las tres casillas (Production, Preview, Development). Guardá y volvé a desplegar para que tome las variables:

```bash
vercel --prod
```

> Si `BREVO_API_KEY` no está configurada, las reservas se siguen guardando normalmente y solo se saltea el envío de mails (queda un aviso en los logs). Nunca se pierde una reserva por un problema de email.

**Configurar el webhook de MercadoPago:** En el dashboard de MercadoPago (Integraciones → Webhooks), agregá la URL `<SITE_URL>/api/payments/webhook` (donde `<SITE_URL>` es el valor de la variable, por ejemplo `https://move-recovery.vercel.app/api/payments/webhook`). MercadoPago genera un `Webhook signing secret` — ese es el valor que va al `MP_WEBHOOK_SECRET` arriba.

---

## Paso 5 — Migraciones y cuenta admin

A diferencia de la versión anterior, la tabla de reservas y la de usuarios admin **no se crean solas**. Con `DATABASE_URL` ya apuntando a Neon (podés usar un `.env` local con la misma connection string, o exportarla en la terminal):

```bash
npm install
npm run migration:run --workspace=server
SEED_ADMIN_EMAIL=vos@move.uy SEED_ADMIN_PASSWORD="una-clave-larga" npm run seed:admin --workspace=server
```

Esto corre las 4 migraciones (`CreateAdminUsers`, `CreateBookings`, `CreateUsers`, `AddUserIdToBookings`), que crean las tablas `admin_users`, `bookings` y `users`, y da de alta la primera (y por ahora única) cuenta para entrar a `/admin`. `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` no hace falta dejarlas configuradas en Vercel — son solo para correr el script una vez.

Para cambiar la clave más adelante, corré `seed:admin` de nuevo con el mismo email: actualiza el hash en vez de crear una cuenta nueva.

---

## Listo

- **Sitio público:** la URL que te dio Vercel (por ejemplo `https://move-recovery.vercel.app`).
- **Probar una reserva:** entrá, elegí fecha y horario, completá y confirmá. Deberían llegar dos mails: la confirmación con el protocolo al cliente y el aviso a `movesc.performance@gmail.com`.
- **Panel de reservas:** abrí `https://TU-URL/admin` e iniciá sesión con el email y la clave que usaste en el Paso 5.

---

## Los dos emails

Al confirmar una reserva se envían dos mails, definidos en `server/src/mail/mail.service.ts`:

1. **Al cliente** — confirmación del turno + qué llevar (chancletas, toalla, ropa deportiva, agua) + protocolo de la sesión paso a paso + uso recomendado + avisos de contraindicaciones.
2. **A `movesc.performance@gmail.com`** — aviso interno con todos los datos del cliente (el email es clickeable y el teléfono abre WhatsApp) y botón directo al panel.

Hay un tercero que sale solo cuando cancelás una reserva desde `/admin` con la casilla "avisarle al cliente" marcada.

### Cómo editar los textos

Todo el contenido editable está en `server/src/mail/mail-content.constants.ts`, en cuatro listas:

| Lista | Qué controla |
|-------|--------------|
| `LLEVAR` | qué tiene que traer el cliente |
| `PROTOCOLO` | los pasos de la sesión |
| `CUANDO_USAR` | recomendaciones de frecuencia |
| `AVISOS` | contraindicaciones a informar |

Cada ítem es `['Título', 'descripción']` (o solo texto en `CUANDO_USAR` y `AVISOS`). Editá, guardá y `vercel --prod`. No hace falta tocar el HTML.

> Revisá `AVISOS` con criterio profesional antes de publicar: la lista es un punto de partida razonable, no una validación clínica.

---

## El panel `/admin`

- **Login:** email + contraseña (JWT) — ver Paso 5 para crear la cuenta.
- **Métricas arriba:** turnos de hoy, próximos 7 días, próximas y total histórico.
- **Filtros:** búsqueda libre por nombre / email / teléfono / notas, período (próximas, hoy, 7 días, pasadas, todas), servicio y fecha exacta.
- **Orden:** clic en los encabezados de Fecha, Cliente o Servicio.
- **Cancelar:** botón por fila, con confirmación. Libera el bloque para que otra persona lo reserve y opcionalmente le avisa al cliente por mail.

La página está marcada como `noindex` y bloqueada en `robots.txt`, así que no aparece en Google.

---

## No me llegan los emails

Entrá a `/admin`, iniciá sesión y tocá el botón **Diagnóstico**. Te dice exactamente qué está bien y qué falta: variables configuradas, conexión a Neon, estado de la cuenta de Brevo, si el remitente está verificado y cuántos emails te quedan. Mirá la lista de problemas y los siguientes pasos sugeridos. Nunca muestra el valor de una credencial, solo los primeros y últimos caracteres. Desde ahí mismo podés mandarte un mail de prueba sin tener que hacer una reserva.

### Las causas más comunes

| Síntoma | Causa | Solución |
|---------|-------|----------|
| `BREVO_API_KEY: FALTA` | No se configuró la variable | Paso 3 y 4 de esta guía |
| Reserva se guarda pero no llega nada | Igual que arriba: el envío se saltea a propósito para no romper la reserva | Paso 3 y 4 |
| `remitente SIN VERIFICAR` | Está cargado en Brevo pero no confirmaste el mail | Buscá el mail de Brevo en `movesc.performance@gmail.com` (revisá spam) y hacé clic en el link |
| `API key rechazada (401)` | Copiaste la **SMTP key** en lugar de la **API key** | Son distintas. Settings → SMTP & API → pestaña **API keys** |
| No puedo entrar a `/admin` | La cuenta admin no existe todavía, o la clave cambió | Corré `npm run seed:admin --workspace=server` (Paso 5) |
| Configuré todo y sigue sin andar | Vercel toma variables nuevas solo en el siguiente deploy | `vercel --prod` o Deployments → Redeploy |
| Llega al equipo pero no al cliente | El mail cayó en spam del cliente | Normal al arrancar con Gmail como remitente. Mejora con dominio propio y DKIM |

### Ver los logs

En Vercel → tu proyecto → **Logs**, filtrá por `[mail]`. Cada envío fallido deja el error textual que devolvió Brevo. En Brevo, **Transactional → Logs** muestra todos los envíos con su estado (entregado, rebotado, spam).

---

## Horarios

Los bloques de 1 h (mañana 7–11, tarde 15–20) están en `server/src/catalog/catalog.constants.ts`, constante `SLOTS`. Editá esa lista y volvé a desplegar para cambiarlos — el front los pide en tiempo real a `GET /api/config`, no hace falta tocar nada del lado del cliente.

## Notas

- **Costo:** los planes gratis de Vercel, Neon y Brevo alcanzan de sobra para arrancar en producción. El límite más cercano es el de Brevo: 300 mails/día = ~150 reservas diarias.
- **Dirección en el mapa:** en `src/components/landing/LocationSection/index.tsx` hay un comentario `TODO` donde va la calle y número.
- **Dominio propio:** después podés conectar un dominio (ej. `recovery.move.uy`) desde Settings → Domains en Vercel. Si lo hacés, actualizá `SITE_URL`.
- **Próximos pasos sugeridos:** recordatorio automático 24 h antes del turno, y confirmación por WhatsApp además del mail.
