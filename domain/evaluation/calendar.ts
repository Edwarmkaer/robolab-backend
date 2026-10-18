/**
 * Fechas de calendario como texto "AAAA-MM-DD".
 *
 * El docente programa una evaluación para un día de su calendario local. Se
 * guarda como texto (no como instante) para que "hoy" signifique lo mismo en
 * el navegador del docente, en el del alumno y en el servidor.
 */

export type CalendarDate = string;

const PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isCalendarDate(value: string): value is CalendarDate {
  const match = PATTERN.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Perú no cambia de hora: el día empieza a las 05:00 UTC. */
export const LIMA_OFFSET_MS = -5 * 60 * 60_000;

/**
 * Fecha de calendario en Perú para un instante. Es la que usa el servidor
 * para decidir qué evaluación es "de hoy", sin confiar en el reloj de la tablet.
 */
export function limaCalendarDate(instant: number = Date.now()): CalendarDate {
  return new Date(instant + LIMA_OFFSET_MS).toISOString().slice(0, 10);
}

/** Fecha local del dispositivo para un instante dado (lo que ve el docente en su pantalla). */
export function localCalendarDate(instant: Date = new Date()): CalendarDate {
  const y = instant.getFullYear();
  const m = String(instant.getMonth() + 1).padStart(2, "0");
  const d = String(instant.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** La misma fecha `days` días después (o antes, si es negativo). */
export function addDays(date: CalendarDate, days: number): CalendarDate {
  if (!isCalendarDate(date)) throw new RangeError(`Fecha no válida: ${date}`);
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(shifted.getUTCDate()).padStart(2, "0");
  return `${shifted.getUTCFullYear()}-${mm}-${dd}`;
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "17 oct" para ejes de gráficos y listas. */
export function shortLabel(date: CalendarDate): string {
  if (!isCalendarDate(date)) return date;
  const [, m, d] = date.split("-").map(Number) as [number, number, number];
  return `${d} ${MONTHS[m - 1]}`;
}
