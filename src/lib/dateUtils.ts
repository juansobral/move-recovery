export const todayStr = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const addDays = (iso: string, n: number): string => {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
};

const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];

export function fechaCorta(iso: string): string {
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y) return iso;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${DIAS_CORTOS[dt.getUTCDay()]} ${d} ${MESES_CORTOS[m - 1]} ${y}`;
}

export const fmtTime = (t: string): string => `${t} – ${String(Number(t.slice(0, 2)) + 1).padStart(2, '0')}:00`;
