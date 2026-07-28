// Envío de emails vía Brevo (plan gratis: 300 emails/día, sin dominio propio).
// Variables de entorno necesarias:
//   BREVO_API_KEY   -> Brevo > Settings > SMTP & API > API keys
//   MAIL_FROM       -> remitente verificado en Brevo (ej. movesc.performance@gmail.com)
//   MAIL_ADMIN      -> a dónde llegan los avisos internos (default: MAIL_FROM)
//   SITE_URL        -> URL pública del sitio, para links en los mails (opcional)

const API_URL = 'https://api.brevo.com/v3/smtp/email';

const FROM_NAME = 'MOVE® Recovery Room';
const FROM_EMAIL = process.env.MAIL_FROM || 'movesc.performance@gmail.com';
const ADMIN_EMAIL = process.env.MAIL_ADMIN || FROM_EMAIL;
const SITE_URL = process.env.SITE_URL || '';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// 2026-08-03 -> "lunes 3 de agosto de 2026" (sin problemas de zona horaria)
export function fechaLarga(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return iso;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${DIAS[dt.getUTCDay()]} ${d} de ${MESES[m - 1]} de ${y}`;
}

/* ------------------------------------------------------------------ */
/* Envío                                                               */
/* ------------------------------------------------------------------ */

async function send({ to, toName, subject, html, text, replyTo }) {
  const key = process.env.BREVO_API_KEY;
  if (!key) {
    console.warn('[mail] BREVO_API_KEY no configurada — se omite el envío a', to);
    return { skipped: true };
  }

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'api-key': key,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: FROM_NAME, email: FROM_EMAIL },
      to: [{ email: to, name: toName || to }],
      replyTo: { email: replyTo || ADMIN_EMAIL, name: FROM_NAME },
      subject,
      htmlContent: html,
      textContent: text,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Brevo ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json().catch(() => ({}));
}

/* ------------------------------------------------------------------ */
/* Layout compartido                                                   */
/* ------------------------------------------------------------------ */

function layout({ preheader, title, body }) {
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;">
<div style="display:none;font-size:1px;color:#f4f4f5;max-height:0;overflow:hidden;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:28px 12px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:6px;overflow:hidden;border:1px solid #e4e4e7;">
    <tr><td style="background:#000000;padding:26px 32px;">
      <p style="margin:0;font:900 26px/1 Arial,Helvetica,sans-serif;color:#ffffff;letter-spacing:2px;">MOVE<sup style="font-size:11px;">®</sup></p>
      <p style="margin:7px 0 0;font:400 11px/1.4 Arial,Helvetica,sans-serif;color:#9a9a9a;letter-spacing:2.5px;text-transform:uppercase;">Strength &amp; Conditioning · Recovery Room</p>
    </td></tr>
    <tr><td style="padding:32px;font:400 15px/1.65 Arial,Helvetica,sans-serif;color:#27272a;">${body}</td></tr>
    <tr><td style="background:#fafafa;border-top:1px solid #e4e4e7;padding:20px 32px;font:400 12px/1.6 Arial,Helvetica,sans-serif;color:#71717a;">
      MOVE® Strength &amp; Conditioning · Montevideo, Uruguay<br />
      <a href="https://www.instagram.com/move_strengthconditioning/" style="color:#71717a;">@move_strengthconditioning</a>
      ${SITE_URL ? ` · <a href="${esc(SITE_URL)}" style="color:#71717a;">${esc(SITE_URL.replace(/^https?:\/\//, ''))}</a>` : ''}
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

function detalleTabla(b) {
  const filas = [
    ['Servicio', b.service],
    ['Fecha', fechaLarga(b.date)],
    ['Hora', `${b.time} h (bloque de 1 hora)`],
  ];
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e4e4e7;border-radius:4px;margin:22px 0;">
${filas
  .map(
    ([k, v], i) => `<tr${i % 2 ? ' style="background:#fafafa;"' : ''}>
  <td style="padding:11px 16px;font:400 12px/1.4 Arial,Helvetica,sans-serif;color:#71717a;text-transform:uppercase;letter-spacing:1.2px;width:34%;">${esc(k)}</td>
  <td style="padding:11px 16px;font:700 15px/1.4 Arial,Helvetica,sans-serif;color:#000;">${esc(v)}</td></tr>`
  )
  .join('\n')}
</table>`;
}

/* ------------------------------------------------------------------ */
/* 1) Mail al cliente — confirmación + protocolo                       */
/* ------------------------------------------------------------------ */
/* Para editar el protocolo, cambiá los textos de PROTOCOLO y LLEVAR.  */

const LLEVAR = [
  ['Chancletas u ojotas', 'obligatorias para circular por el área de sauna y ducha.'],
  ['Toalla', 'una para el sauna y, si querés, otra para la ducha.'],
  ['Ropa deportiva cómoda y seca', 'para la sesión de presoterapia y luz roja.'],
  ['Botella de agua', 'la hidratación antes y después es parte del protocolo.'],
  ['Malla o remera y short livianos', 'si vas a usar el sauna infrarrojo.'],
];

const PROTOCOLO = [
  ['1. Llegá 10 minutos antes', 'Así aprovechás el bloque completo. La sesión dura 1 hora e incluye la transición entre estaciones.'],
  ['2. Hidratación previa', 'Tomá agua antes de empezar, sobre todo si vas a usar sauna. Evitá venir en ayunas prolongado.'],
  ['3. Orden recomendado', 'Sauna infrarrojo o luz roja e infrarroja primero, después presoterapia y cerramos con sillón de gravedad cero + respiración. Trabajamos de lo más activo a lo más calmo.'],
  ['4. Duchate antes del sauna', 'Entrar con la piel limpia y seca mejora la tolerancia al calor y la experiencia.'],
  ['5. Escuchá tu cuerpo', 'Si sentís mareo, palpitaciones o mucho malestar con el calor, cortá la estación y avisale al profesional a cargo.'],
  ['6. Después de la sesión', 'Volvé a hidratarte y evitá entrenamientos de alta intensidad en las siguientes 2 horas: el objetivo es recuperar.'],
];

const CUANDO_USAR = [
  'El mismo día o el día después de una sesión de entrenamiento o competencia intensa.',
  'En semanas de mucha carga o poco descanso, para bajar la fatiga acumulada.',
  'Como recuperación activa en días sin entrenamiento.',
  'Recomendado 1 a 3 veces por semana, según tu volumen de entrenamiento.',
];

const AVISOS = [
  'Embarazo, o si estás buscando un embarazo.',
  'Trombosis venosa profunda, trombosis reciente o antecedentes de coágulos.',
  'Insuficiencia cardíaca, arritmias o hipertensión no controlada.',
  'Infección o fiebre en el momento de la sesión.',
  'Heridas abiertas, quemaduras o infecciones en la piel.',
  'Fractura reciente o sospecha de fractura.',
  'Marcapasos u otro dispositivo implantado.',
  'Medicación que afecte la presión arterial o la termorregulación.',
];

export function mailCliente(b) {
  const bullets = (arr) =>
    arr
      .map(
        ([t, d]) =>
          `<li style="margin-bottom:11px;"><strong style="color:#000;">${esc(t)}</strong> — ${esc(d)}</li>`
      )
      .join('');

  const plain = (arr) => arr.map((x) => `<li style="margin-bottom:7px;">${esc(x)}</li>`).join('');

  const body = `
<p style="margin:0 0 6px;font:900 22px/1.25 Arial,Helvetica,sans-serif;color:#000;text-transform:uppercase;">Reserva confirmada</p>
<p style="margin:0 0 4px;">Hola ${esc(b.name.split(' ')[0])}, tu turno en el <strong>Recovery Room by MOVE</strong> quedó agendado.</p>

${detalleTabla(b)}

<h2 style="margin:30px 0 12px;font:900 15px/1.3 Arial,Helvetica,sans-serif;color:#000;text-transform:uppercase;letter-spacing:1.5px;border-bottom:2px solid #000;padding-bottom:8px;">Qué tenés que llevar</h2>
<ul style="margin:0;padding-left:20px;">${bullets(LLEVAR)}</ul>

<h2 style="margin:30px 0 12px;font:900 15px/1.3 Arial,Helvetica,sans-serif;color:#000;text-transform:uppercase;letter-spacing:1.5px;border-bottom:2px solid #000;padding-bottom:8px;">Protocolo de la sesión</h2>
<ul style="margin:0;padding-left:20px;list-style:none;">${bullets(PROTOCOLO)}</ul>

<h2 style="margin:30px 0 12px;font:900 15px/1.3 Arial,Helvetica,sans-serif;color:#000;text-transform:uppercase;letter-spacing:1.5px;border-bottom:2px solid #000;padding-bottom:8px;">Uso recomendado</h2>
<ul style="margin:0;padding-left:20px;">${plain(CUANDO_USAR)}</ul>

<div style="margin:30px 0 0;padding:18px 20px;background:#fff7ed;border-left:3px solid #f59e0b;border-radius:3px;">
  <p style="margin:0 0 9px;font:700 13px/1.4 Arial,Helvetica,sans-serif;color:#92400e;text-transform:uppercase;letter-spacing:1px;">Avisanos antes de la sesión si</p>
  <ul style="margin:0;padding-left:18px;font-size:14px;color:#78350f;">${plain(AVISOS)}</ul>
  <p style="margin:11px 0 0;font-size:13px;color:#78350f;">No es una consulta médica. Ante dudas, consultá con tu médico antes de usar el Recovery Room.</p>
</div>

<div style="margin:28px 0 0;padding-top:20px;border-top:1px solid #e4e4e7;">
  <p style="margin:0 0 6px;font:700 13px/1.4 Arial,Helvetica,sans-serif;color:#000;text-transform:uppercase;letter-spacing:1px;">¿Necesitás cambiar o cancelar?</p>
  <p style="margin:0;">Escribinos por Instagram a <a href="https://www.instagram.com/move_strengthconditioning/" style="color:#000;font-weight:bold;">@move_strengthconditioning</a> o respondé este mail con al menos 4 horas de anticipación. Así liberamos el bloque para otra persona.</p>
</div>

<p style="margin:26px 0 0;color:#71717a;">Nos vemos. Buen descanso,<br /><strong style="color:#000;">Equipo MOVE®</strong></p>`;

  const text = `RESERVA CONFIRMADA — Recovery Room by MOVE

Hola ${b.name.split(' ')[0]}, tu turno quedó agendado.

Servicio: ${b.service}
Fecha: ${fechaLarga(b.date)}
Hora: ${b.time} h (bloque de 1 hora)

QUÉ LLEVAR
${LLEVAR.map(([t, d]) => `- ${t}: ${d}`).join('\n')}

PROTOCOLO
${PROTOCOLO.map(([t, d]) => `${t}. ${d}`).join('\n')}

USO RECOMENDADO
${CUANDO_USAR.map((x) => `- ${x}`).join('\n')}

AVISANOS ANTES SI
${AVISOS.map((x) => `- ${x}`).join('\n')}
No es una consulta médica. Ante dudas, consultá con tu médico.

Cambios o cancelaciones: Instagram @move_strengthconditioning o respondiendo este mail, con al menos 4 h de anticipación.

Equipo MOVE®`;

  return {
    to: b.email,
    toName: b.name,
    subject: `Reserva confirmada · ${b.service} · ${fechaLarga(b.date)} ${b.time} h`,
    html: layout({
      preheader: `Tu turno del ${fechaLarga(b.date)} a las ${b.time} h está confirmado. Acordate de las chancletas y la toalla.`,
      title: 'Reserva confirmada',
      body,
    }),
    text,
  };
}

/* ------------------------------------------------------------------ */
/* 2) Mail interno al equipo                                           */
/* ------------------------------------------------------------------ */

export function mailAdmin(b) {
  const body = `
<p style="margin:0 0 18px;font:900 22px/1.25 Arial,Helvetica,sans-serif;color:#000;text-transform:uppercase;">Nueva reserva</p>

${detalleTabla(b)}

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e4e4e7;border-radius:4px;">
  <tr><td style="padding:11px 16px;font:400 12px/1.4 Arial,Helvetica,sans-serif;color:#71717a;text-transform:uppercase;letter-spacing:1.2px;width:34%;">Nombre</td>
      <td style="padding:11px 16px;font:700 15px/1.4 Arial,Helvetica,sans-serif;color:#000;">${esc(b.name)}</td></tr>
  <tr style="background:#fafafa;"><td style="padding:11px 16px;font:400 12px/1.4 Arial,Helvetica,sans-serif;color:#71717a;text-transform:uppercase;letter-spacing:1.2px;">Email</td>
      <td style="padding:11px 16px;font:400 15px/1.4 Arial,Helvetica,sans-serif;"><a href="mailto:${esc(b.email)}" style="color:#000;">${esc(b.email)}</a></td></tr>
  <tr><td style="padding:11px 16px;font:400 12px/1.4 Arial,Helvetica,sans-serif;color:#71717a;text-transform:uppercase;letter-spacing:1.2px;">Teléfono</td>
      <td style="padding:11px 16px;font:400 15px/1.4 Arial,Helvetica,sans-serif;"><a href="https://wa.me/${esc(String(b.phone).replace(/[^\d]/g, ''))}" style="color:#000;">${esc(b.phone)}</a></td></tr>
  <tr style="background:#fafafa;"><td style="padding:11px 16px;font:400 12px/1.4 Arial,Helvetica,sans-serif;color:#71717a;text-transform:uppercase;letter-spacing:1.2px;">Notas</td>
      <td style="padding:11px 16px;font:400 15px/1.4 Arial,Helvetica,sans-serif;color:${b.notes ? '#000' : '#a1a1aa'};">${esc(b.notes || '— sin notas —')}</td></tr>
  <tr><td style="padding:11px 16px;font:400 12px/1.4 Arial,Helvetica,sans-serif;color:#71717a;text-transform:uppercase;letter-spacing:1.2px;">Reserva #</td>
      <td style="padding:11px 16px;font:400 15px/1.4 Arial,Helvetica,sans-serif;color:#000;">${esc(b.id)}</td></tr>
</table>

<p style="margin:22px 0 0;font-size:14px;color:#71717a;">Al cliente ya se le envió el mail con el protocolo y qué llevar.</p>
${SITE_URL ? `<p style="margin:20px 0 0;"><a href="${esc(SITE_URL)}/admin" style="display:inline-block;background:#000;color:#fff;font:700 13px/1 Arial,Helvetica,sans-serif;text-transform:uppercase;letter-spacing:1.5px;padding:14px 24px;border-radius:4px;text-decoration:none;">Ver todas las reservas</a></p>` : ''}`;

  const text = `NUEVA RESERVA #${b.id}

Servicio: ${b.service}
Fecha: ${fechaLarga(b.date)}
Hora: ${b.time} h

Nombre: ${b.name}
Email: ${b.email}
Teléfono: ${b.phone}
Notas: ${b.notes || '(sin notas)'}

Al cliente ya se le envió el mail con el protocolo.`;

  return {
    to: ADMIN_EMAIL,
    toName: 'MOVE® Recovery Room',
    subject: `Nueva reserva · ${b.date} ${b.time} · ${b.name}`,
    html: layout({
      preheader: `${b.name} reservó ${b.service} para el ${b.date} a las ${b.time} h.`,
      title: 'Nueva reserva',
      body,
    }),
    text,
    replyTo: b.email,
  };
}

/* ------------------------------------------------------------------ */
/* 3) Mail de cancelación al cliente                                   */
/* ------------------------------------------------------------------ */

export function mailCancelacion(b) {
  const body = `
<p style="margin:0 0 6px;font:900 22px/1.25 Arial,Helvetica,sans-serif;color:#000;text-transform:uppercase;">Reserva cancelada</p>
<p style="margin:0;">Hola ${esc(b.name.split(' ')[0])}, cancelamos el siguiente turno en el Recovery Room:</p>

${detalleTabla(b)}

<p style="margin:0;">Si fue un error o querés reagendar, escribinos por Instagram a <a href="https://www.instagram.com/move_strengthconditioning/" style="color:#000;font-weight:bold;">@move_strengthconditioning</a>${SITE_URL ? ` o reservá otro horario en <a href="${esc(SITE_URL)}#reservar" style="color:#000;font-weight:bold;">nuestro sitio</a>` : ''}.</p>

<p style="margin:26px 0 0;color:#71717a;">Gracias,<br /><strong style="color:#000;">Equipo MOVE®</strong></p>`;

  return {
    to: b.email,
    toName: b.name,
    subject: `Reserva cancelada · ${fechaLarga(b.date)} ${b.time} h`,
    html: layout({ preheader: `Tu turno del ${fechaLarga(b.date)} a las ${b.time} h fue cancelado.`, title: 'Reserva cancelada', body }),
    text: `RESERVA CANCELADA\n\nHola ${b.name.split(' ')[0]}, cancelamos tu turno:\n\n${b.service}\n${fechaLarga(b.date)} — ${b.time} h\n\nPara reagendar, escribinos a @move_strengthconditioning.\n\nEquipo MOVE®`,
  };
}

/* ------------------------------------------------------------------ */
/* Envío tolerante a fallos: un error de mail no rompe la reserva.     */
/* ------------------------------------------------------------------ */

export async function enviar(...mensajes) {
  const results = await Promise.allSettled(mensajes.map((m) => send(m)));
  results.forEach((r, i) => {
    if (r.status === 'rejected') console.error(`[mail] fallo el envío a ${mensajes[i].to}:`, r.reason?.message || r.reason);
  });
  return results.every((r) => r.status === 'fulfilled');
}
