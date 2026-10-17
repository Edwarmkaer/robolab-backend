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

/** Fecha local del dispositivo para un instante dado. */
export function localCalendarDate(instant: Date = new Date()): CalendarDate {
  const y = instant.getFullYear();
  const m = String(instant.getMonth() + 1).padStart(2, "0");
  const d = String(instant.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "17 oct" para ejes de gráficos y listas. */
export function shortLabel(date: CalendarDate): string {
  if (!isCalendarDate(date)) return date;
  const [, m, d] = date.split("-").map(Number) as [number, number, number];
  return `${d} ${MONTHS[m - 1]}`;
}
