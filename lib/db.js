// Conexión a Neon (Postgres) + configuración compartida
import { neon } from '@neondatabase/serverless';

export const SLOTS = ['07:00', '08:00', '09:00', '10:00', '15:00', '16:00', '17:00', '18:00', '19:00'];
export const SERVICIOS = ['Recovery Room', 'Presoterapia', 'Luz roja e infrarroja', 'Sauna infrarrojo', 'Sillón gravedad cero', 'Meditación y respiración'];

export const sql = neon(process.env.DATABASE_URL);

// Crea la tabla una sola vez por instancia (idempotente).
let ready;
export function ensureTable() {
  if (!ready) {
    ready = sql`
      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        service TEXT NOT NULL,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(date, time)
      )
    `;
  }
  return ready;
}

// Helpers de validación (compartidos)
export const isValidDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !Number.isNaN(Date.parse(s));
export const isValidEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s || '');
export const todayStr = () => new Date().toISOString().slice(0, 10);
