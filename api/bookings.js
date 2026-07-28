import { sql, ensureTable, SLOTS, SERVICIOS, isValidDate, isValidEmail, todayStr } from '../lib/db.js';
import { enviar, mailCliente, mailAdmin, mailCancelacion } from '../lib/mail.js';

const ADMIN_KEY = process.env.ADMIN_KEY || 'move-admin';

const autorizado = (req) => {
  const key = req.query?.key || req.headers['x-admin-key'];
  return key === ADMIN_KEY;
};

export default async function handler(req, res) {
  /* ---------------- Listado admin ---------------- */
  if (req.method === 'GET') {
    if (!autorizado(req)) return res.status(401).json({ error: 'No autorizado.' });
    await ensureTable();
    const rows = await sql`SELECT * FROM bookings ORDER BY date DESC, time DESC`;
    return res.status(200).json(rows);
  }

  /* ---------------- Crear reserva ---------------- */
  if (req.method === 'POST') {
    const { date, time, name, email, phone, service, notes } = req.body || {};

    if (!isValidDate(date)) return res.status(400).json({ error: 'Fecha inválida.' });
    if (date < todayStr()) return res.status(400).json({ error: 'No se puede reservar en una fecha pasada.' });
    if (!SLOTS.includes(time)) return res.status(400).json({ error: 'Bloque horario no disponible.' });
    if (!name || name.trim().length < 2) return res.status(400).json({ error: 'Ingresá tu nombre.' });
    if (!isValidEmail(email)) return res.status(400).json({ error: 'Email inválido.' });
    if (!phone || phone.trim().length < 6) return res.status(400).json({ error: 'Ingresá un teléfono válido.' });
    const svc = SERVICIOS.includes(service) ? service : 'Recovery Room';

    await ensureTable();
    try {
      const rows = await sql`
        INSERT INTO bookings (date, time, name, email, phone, service, notes)
        VALUES (${date}, ${time}, ${name.trim()}, ${email.trim()}, ${phone.trim()}, ${svc}, ${(notes || '').trim()})
        RETURNING *
      `;
      const booking = rows[0];

      // Los mails no deben poder romper una reserva ya guardada.
      const enviados = await enviar(mailCliente(booking), mailAdmin(booking)).catch((e) => {
        console.error('[bookings] error inesperado enviando mails:', e);
        return false;
      });

      return res.status(201).json({
        id: booking.id,
        date: booking.date,
        time: booking.time,
        service: booking.service,
        emailSent: enviados,
      });
    } catch (e) {
      if (e.code === '23505' || e.code === '23P01' || String(e.message).includes('duplicate')) {
        return res.status(409).json({ error: 'Ese bloque ya fue reservado. Elegí otro horario.' });
      }
      console.error(e);
      return res.status(500).json({ error: 'Error del servidor.' });
    }
  }

  /* ---------------- Cancelar reserva (admin) ---------------- */
  if (req.method === 'DELETE') {
    if (!autorizado(req)) return res.status(401).json({ error: 'No autorizado.' });

    const id = Number(req.query?.id ?? req.body?.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID inválido.' });

    // ?notify=0 para cancelar sin avisarle al cliente.
    const notify = String(req.query?.notify ?? '1') !== '0';

    await ensureTable();
    try {
      const rows = await sql`DELETE FROM bookings WHERE id = ${id} RETURNING *`;
      if (!rows.length) return res.status(404).json({ error: 'Reserva no encontrada.' });

      let notified = false;
      if (notify) {
        notified = await enviar(mailCancelacion(rows[0])).catch(() => false);
      }
      return res.status(200).json({ ok: true, id, notified });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: 'Error del servidor.' });
    }
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  res.status(405).json({ error: 'Método no permitido.' });
}
