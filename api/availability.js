import { sql, ensureTable, SLOTS, isValidDate, todayStr } from '../lib/db.js';

export default async function handler(req, res) {
  const { date } = req.query;
  if (!isValidDate(date)) return res.status(400).json({ error: 'Fecha inválida. Formato AAAA-MM-DD.' });

  await ensureTable();
  const rows = await sql`SELECT time FROM bookings WHERE date = ${date}`;
  const taken = new Set(rows.map((r) => r.time));
  const past = date < todayStr();
  const slots = SLOTS.map((time) => ({ time, available: !past && !taken.has(time) }));
  res.status(200).json({ date, slots });
}
