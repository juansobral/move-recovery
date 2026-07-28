# Deploy en Vercel + Neon — MOVE Recovery Room

Guía paso a paso para dejar el sitio online con una URL pública y reservas que se guardan de verdad. Son ~10 minutos. No hace falta saber programar.

Estructura del proyecto (ya lista):

```
move-recovery-vercel/
├─ index.html        # sitio público (estático)
├─ styles.css
├─ app.js
├─ admin.html        # panel de reservas → se abre en /admin
├─ admin.css
├─ admin.js
├─ img/              # fotos del equipo
├─ api/              # funciones serverless (backend)
│  ├─ config.js
│  ├─ availability.js
│  └─ bookings.js    # crear (POST), listar (GET), cancelar (DELETE)
├─ lib/
│  ├─ db.js          # conexión a la base Neon
│  └─ mail.js        # envío de emails + plantillas
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

> No hace falta crear ninguna tabla a mano: la app la crea sola la primera vez que se usa.

---

## Paso 2 — Subir el proyecto a Vercel

Cualquiera de las dos formas funciona. La **A** es la más simple si no usás Git.

### Opción A — con la línea de comandos (rápida)

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

### Opción B — desde la web de Vercel

1. Subí esta carpeta a un repositorio de GitHub.
2. En https://vercel.com → "Add New… → Project" → importá ese repo.
3. Dejá todo por defecto (Vercel detecta las funciones de `/api` solo) y dale "Deploy".

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
| `ADMIN_KEY` | una clave inventada por vos, larga | entrar a `/admin` |
| `BREVO_API_KEY` | la API key del Paso 3 (`xkeysib-…`) | enviar los emails |
| `MAIL_FROM` | `movesc.performance@gmail.com` | remitente (tiene que ser el verificado en Brevo) |
| `MAIL_ADMIN` | `movesc.performance@gmail.com` | a dónde llega el aviso de nueva reserva |
| `SITE_URL` | la URL pública, ej. `https://move-recovery.vercel.app` (sin `/` al final) | links dentro de los emails |

Marcá las tres casillas (Production, Preview, Development). Guardá y volvé a desplegar para que tome las variables:

```bash
vercel --prod
```

(o en la web: pestaña "Deployments" → botón "Redeploy").

> Si `BREVO_API_KEY` no está configurada, las reservas se siguen guardando normalmente y solo se saltea el envío de mails (queda un aviso en los logs). Nunca se pierde una reserva por un problema de email.

---

## Listo

- **Sitio público:** la URL que te dio Vercel (por ejemplo `https://move-recovery.vercel.app`).
- **Probar una reserva:** entrá, elegí fecha y horario, completá y confirmá. Deberían llegar dos mails: la confirmación con el protocolo al cliente y el aviso a `movesc.performance@gmail.com`.
- **Panel de reservas:** abrí `https://TU-URL/admin` y poné tu `ADMIN_KEY`. Queda guardada en el navegador, así que no la pedís cada vez.

---

## Los dos emails

Al confirmar una reserva se envían dos mails, definidos en `lib/mail.js`:

1. **Al cliente** — confirmación del turno + qué llevar (chancletas, toalla, ropa deportiva, agua) + protocolo de la sesión paso a paso + uso recomendado + avisos de contraindicaciones.
2. **A `movesc.performance@gmail.com`** — aviso interno con todos los datos del cliente (el email es clickeable y el teléfono abre WhatsApp) y botón directo al panel.

Hay un tercero que sale solo cuando cancelás una reserva desde `/admin` con la casilla "avisarle al cliente" marcada.

### Cómo editar los textos

Todo el contenido editable está arriba en `lib/mail.js`, en cuatro listas:

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

- **Métricas arriba:** turnos de hoy, próximos 7 días, próximas y total histórico.
- **Filtros:** búsqueda libre por nombre / email / teléfono / notas, período (próximas, hoy, 7 días, pasadas, todas), servicio y fecha exacta.
- **Orden:** clic en los encabezados de Fecha, Cliente o Servicio.
- **Cancelar:** botón por fila, con confirmación. Libera el bloque para que otra persona lo reserve y opcionalmente le avisa al cliente por mail.

La página está marcada como `noindex` y bloqueada en `robots.txt`, así que no aparece en Google. La protección es la `ADMIN_KEY`: usá una clave larga y no la compartas por canales públicos.

---

## No me llegan los emails

Abrí esta URL en el navegador:

```
https://TU-URL/api/diag?key=TU_ADMIN_KEY
```

Te dice exactamente qué está bien y qué falta: variables configuradas, conexión a Neon, estado de la cuenta de Brevo, si el remitente está verificado y cuántos emails te quedan. Mirá la lista `problemas` y la de `siguientes_pasos`. Nunca muestra el valor de una credencial, solo los primeros y últimos caracteres.

Para mandarte un mail de prueba sin tener que hacer una reserva:

```
https://TU-URL/api/diag?key=TU_ADMIN_KEY&test=tu@email.com
```

Llega el mail de confirmación completo, con el protocolo, tal como lo recibe un cliente.

### Las causas más comunes

| Síntoma | Causa | Solución |
|---------|-------|----------|
| `BREVO_API_KEY: FALTA` | No se configuró la variable | Paso 3 y 4 de esta guía |
| Reserva se guarda pero no llega nada | Igual que arriba: el envío se saltea a propósito para no romper la reserva | Paso 3 y 4 |
| `remitente SIN VERIFICAR` | Está cargado en Brevo pero no confirmaste el mail | Buscá el mail de Brevo en `movesc.performance@gmail.com` (revisá spam) y hacé clic en el link |
| `API key rechazada (401)` | Copiaste la **SMTP key** en lugar de la **API key** | Son distintas. Settings → SMTP & API → pestaña **API keys** |
| Configuré todo y sigue sin andar | Vercel toma variables nuevas solo en el siguiente deploy | `vercel --prod` o Deployments → Redeploy |
| Llega al equipo pero no al cliente | El mail cayó en spam del cliente | Normal al arrancar con Gmail como remitente. Mejora con dominio propio y DKIM |

### Ver los logs

En Vercel → tu proyecto → **Logs**, filtrá por `[mail]`. Cada envío fallido deja el error textual que devolvió Brevo. En Brevo, **Transactional → Logs** muestra todos los envíos con su estado (entregado, rebotado, spam).

---

## Horarios

Los bloques de 1 h (mañana 7–11, tarde 15–20) están en `lib/db.js`, constante `SLOTS`. Editá esa lista y volvé a desplegar para cambiarlos.

## Notas

- **Costo:** los planes gratis de Vercel, Neon y Brevo alcanzan de sobra para arrancar en producción. El límite más cercano es el de Brevo: 300 mails/día = ~150 reservas diarias.
- **Dirección en el mapa:** en `index.html`, sección `#ubicacion`, hay un comentario `<!-- TODO -->` donde va la calle y número.
- **Dominio propio:** después podés conectar un dominio (ej. `recovery.move.uy`) desde Settings → Domains en Vercel. Si lo hacés, actualizá `SITE_URL`.
- **Próximos pasos sugeridos:** recordatorio automático 24 h antes del turno, y confirmación por WhatsApp además del mail.
