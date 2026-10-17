/**
 * Cuántos correos se pueden pedir para una misma dirección. Evita que
 * alguien llene de códigos el correo de un docente.
 */

export const RESEND_WAIT_MS = 60_000;
export const HOUR_MS = 60 * 60_000;
export const MAX_PER_HOUR = 5;

export type SendDecision = { readonly ok: true } | { readonly ok: false; readonly retryInMs: number };

/** @param recentSentAts momentos de los envíos que no fallaron, de cualquier antigüedad. */
export function checkSendAllowed(recentSentAts: readonly number[], now: number): SendDecision {
  const lastHour = recentSentAts.filter((t) => now - t < HOUR_MS);
  const latest = Math.max(...lastHour, -Infinity);
  if (now - latest < RESEND_WAIT_MS) return { ok: false, retryInMs: RESEND_WAIT_MS - (now - latest) };
  if (lastHour.length >= MAX_PER_HOUR) {
    return { ok: false, retryInMs: Math.min(...lastHour) + HOUR_MS - now };
  }
  return { ok: true };
}
