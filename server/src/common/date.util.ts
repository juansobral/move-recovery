export const todayStr = (): string => new Date().toISOString().slice(0, 10);

export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const totalMonths = m - 1 + months;
  const targetYear = y + Math.floor(totalMonths / 12);
  const targetMonthIndex = ((totalMonths % 12) + 12) % 12;
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonthIndex + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDayOfTargetMonth);
  const dt = new Date(Date.UTC(targetYear, targetMonthIndex, day));
  return dt.toISOString().slice(0, 10);
}
