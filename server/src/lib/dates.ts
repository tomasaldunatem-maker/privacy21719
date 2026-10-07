/** Fechas como 'YYYY-MM-DD' en hora de Chile, sin depender de la zona del servidor. */
const TZ = 'America/Santiago';

export function todayISO(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Días desde `from` hasta `to` (positivo si `to` es posterior). */
const utc = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
export function daysBetween(from: string, to: string): number {
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}

/** Ley 21.719, art. 11: 30 días corridos, prorrogables por otros 30. */
export const REQUEST_DAYS = 30;
export const REQUEST_EXTENSION_DAYS = 30;
export const requestDueDate = (receivedAt: string, extended = false) =>
  addDaysISO(receivedAt, REQUEST_DAYS + (extended ? REQUEST_EXTENSION_DAYS : 0));

export const LAW_EFFECTIVE_DATE = '2026-12-01';
