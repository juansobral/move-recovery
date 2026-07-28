// Diagnóstico de configuración. Protegido con ADMIN_KEY.
//
//   /api/diag?key=TU_ADMIN_KEY                    → qué está configurado y qué falta
//   /api/diag?key=TU_ADMIN_KEY&test=tu@email.com  → además manda un mail de prueba
//
// Nunca devuelve el valor de una credencial, solo si está presente y su forma.

import { sql, ensureTable } from '../lib/db.js';

const ADMIN_KEY = process.env.ADMIN_KEY || 'move-admin';

// Muestra solo el principio y el final de una credencial.
const pista = (v) => (!v ? null : v.length <= 12 ? `${v.slice(0, 3)}…` : `${v.slice(0, 8)}…${v.slice(-4)}`);

export default async function handler(req, res) {
  const key = req.query?.key || req.headers['x-admin-key'];
  if (key !== ADMIN_KEY) return res.status(401).json({ error: 'No autorizado.' });

  const env = {
    DATABASE_URL: process.env.DATABASE_URL,
    ADMIN_KEY: process.env.ADMIN_KEY,
    BREVO_API_KEY: process.env.BREVO_API_KEY,
    MAIL_FROM: process.env.MAIL_FROM,
    MAIL_ADMIN: process.env.MAIL_ADMIN,
    SITE_URL: process.env.SITE_URL,
  };

  const out = {
    deploy: {
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || '(desconocido)',
      entorno: process.env.VERCEL_ENV || 'local',
      region: process.env.VERCEL_REGION || '—',
      hora: new Date().toISOString(),
    },
    variables: {},
    base_de_datos: {},
    emails: {},
    problemas: [],
    siguientes_pasos: [],
  };

  /* ---------------- Variables de entorno ---------------- */
  for (const [k, v] of Object.entries(env)) {
    out.variables[k] = v ? (k.includes('KEY') || k === 'DATABASE_URL' ? `configurada (${pista(v)})` : v) : 'FALTA';
  }

  if (!env.DATABASE_URL) out.problemas.push('Falta DATABASE_URL: no se pueden guardar reservas.');
  if (!env.ADMIN_KEY) out.problemas.push('ADMIN_KEY no está configurada: se está usando la clave por defecto "move-admin". Cambiala.');

  if (!env.BREVO_API_KEY) {
    out.problemas.push('Falta BREVO_API_KEY: los emails no se envían (las reservas sí se guardan).');
    out.siguientes_pasos.push('Creá una cuenta en brevo.com, verificá el remitente y generá una API key. Ver Paso 3 del DEPLOY.md.');
  } else if (!env.BREVO_API_KEY.startsWith('xkeysib-')) {
    out.problemas.push('BREVO_API_KEY no arranca con "xkeysib-". Puede que hayas copiado la SMTP key en lugar de la API key: son credenciales distintas.');
  }

  if (!env.MAIL_FROM) out.siguientes_pasos.push('Sin MAIL_FROM se usa movesc.performance@gmail.com por defecto. Tiene que estar verificado en Brevo.');
  if (!env.SITE_URL) out.siguientes_pasos.push('Sin SITE_URL los emails salen sin los links al sitio (no es grave).');
  else if (env.SITE_URL.endsWith('/')) out.problemas.push('SITE_URL termina en "/". Quitá la barra final para que los links no queden dobles.');

  /* ---------------- Base de datos ---------------- */
  if (env.DATABASE_URL) {
    try {
      await ensureTable();
      const rows = await sql`SELECT COUNT(*)::int AS n FROM bookings`;
      out.base_de_datos = { conexion: 'OK', reservas_guardadas: rows?.[0]?.n ?? '(no se pudo contar)' };
    } catch (e) {
      out.base_de_datos = { conexion: 'ERROR', detalle: String(e.message).slice(0, 200) };
      out.problemas.push('No se pudo conectar a Neon. Revisá que DATABASE_URL sea la connection string "pooled" y esté completa.');
    }
  } else {
    out.base_de_datos = { conexion: 'sin DATABASE_URL' };
  }

  /* ---------------- Cuenta de Brevo ---------------- */
  if (env.BREVO_API_KEY) {
    const from = env.MAIL_FROM || 'movesc.performance@gmail.com';
    try {
      const r = await fetch('https://api.brevo.com/v3/account', {
        headers: { 'api-key': env.BREVO_API_KEY, accept: 'application/json' },
      });
      if (r.status === 401) {
        out.emails.cuenta = 'API key rechazada (401)';
        out.problemas.push('Brevo rechazó la API key. Generá una nueva en Settings → SMTP & API → API keys y actualizala en Vercel.');
      } else if (!r.ok) {
        out.emails.cuenta = `respuesta inesperada (${r.status})`;
      } else {
        const acc = await r.json();
        out.emails.cuenta = `OK — ${acc.email || ''}`.trim();
        const limite = acc.plan?.find?.((p) => p.credits != null);
        if (limite) out.emails.credito = `${limite.credits} emails disponibles (${limite.type})`;

        // ¿Está verificado el remitente que vamos a usar?
        const sr = await fetch('https://api.brevo.com/v3/senders', {
          headers: { 'api-key': env.BREVO_API_KEY, accept: 'application/json' },
        });
        if (sr.ok) {
          const { senders = [] } = await sr.json();
          const mine = senders.find((s) => s.email?.toLowerCase() === from.toLowerCase());
          if (!mine) {
            out.emails.remitente = `${from} NO está dado de alta en Brevo`;
            out.problemas.push(`El remitente ${from} no existe en tu cuenta de Brevo. Agregalo en Settings → Senders y confirmá el mail que te llega.`);
          } else if (mine.active === false) {
            out.emails.remitente = `${from} dado de alta pero SIN VERIFICAR`;
            out.problemas.push(`El remitente ${from} está cargado pero no confirmado. Buscá el mail de Brevo en esa casilla (mirá también spam) y hacé clic en el link.`);
          } else {
            out.emails.remitente = `${from} verificado`;
          }
        }
      }
    } catch (e) {
      out.emails.cuenta = 'ERROR de red';
      out.emails.detalle = String(e.message).slice(0, 200);
    }
  } else {
    out.emails.cuenta = 'sin BREVO_API_KEY';
  }

  /* ---------------- Envío de prueba ---------------- */
  const destino = req.query?.test;
  if (destino) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destino)) {
      out.emails.prueba = 'el parámetro ?test= no es un email válido';
    } else if (!env.BREVO_API_KEY) {
      out.emails.prueba = 'no se puede probar sin BREVO_API_KEY';
    } else {
      const { mailCliente } = await import('../lib/mail.js');
      const ejemplo = mailCliente({
        id: 0,
        date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        time: '17:00',
        name: 'Prueba MOVE',
        email: destino,
        phone: '+598 99 000 000',
        service: 'Recovery Room',
        notes: 'Mail de prueba enviado desde /api/diag',
      });
      try {
        const r = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: { 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({
            sender: { name: 'MOVE® Recovery Room', email: env.MAIL_FROM || 'movesc.performance@gmail.com' },
            to: [{ email: destino, name: 'Prueba' }],
            subject: '[PRUEBA] Así se ve el mail de confirmación · MOVE®',
            htmlContent: ejemplo.html,
            textContent: ejemplo.text,
          }),
        });
        const body = await r.text();
        if (r.ok) {
          out.emails.prueba = `enviado a ${destino} — revisá la casilla y también spam`;
        } else {
          out.emails.prueba = `FALLÓ (${r.status})`;
          out.emails.prueba_detalle = body.slice(0, 400);
          if (r.status === 400 && body.includes('sender')) {
            out.problemas.push('Brevo rechazó el remitente. Tiene que ser una casilla verificada en tu cuenta.');
          }
        }
      } catch (e) {
        out.emails.prueba = 'ERROR de red: ' + String(e.message).slice(0, 200);
      }
    }
  } else {
    out.emails.prueba = 'agregá &test=tu@email.com a esta URL para enviar un mail de prueba';
  }

  /* ---------------- Resumen ---------------- */
  out.resumen = out.problemas.length === 0
    ? 'Todo en orden. Los emails deberían estar saliendo.'
    : `${out.problemas.length} problema(s) a resolver — mirá la lista "problemas".`;

  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json(out);
}
