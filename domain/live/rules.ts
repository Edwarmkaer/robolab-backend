import { MAX_LIVE_PARTICIPANTS, type LiveStatus } from "./maze";

/** Reglas comunes del reto: los permisos y las escrituras quedan en Convex. */
export function requireRunning(status: LiveStatus): void {
  if (status === "closed") throw new Error("La sala está cerrada.");
  if (status !== "running") throw new Error("El docente todavía no ha iniciado la sala.");
}
export function requireUnsolved(finishedAt: number | null): void {
  if (finishedAt !== null) throw new Error("El laberinto ya está resuelto.");
}
export function requireRevision(revision: number | undefined, current: number): void {
  if (!Number.isSafeInteger(revision) || revision !== current) throw new Error("El programa cambió. Revisa los movimientos e inténtalo otra vez.");
}
export function requireCanJoin(status: LiveStatus, count: number): void {
  if (status !== "waiting") throw new Error("La sala ya ha iniciado. Espera el próximo reto.");
  if (count >= MAX_LIVE_PARTICIPANTS) throw new Error("La sala llegó a 100 participantes.");
}
export function requireCanStart(count: number): void {
  if (count === 0) throw new Error("Espera al menos a un participante antes de iniciar.");
}
export function requireRequestId(requestId: string): void {
  if (!requestId.trim() || requestId.length > 128) throw new Error("Reintenta la ejecución con una solicitud válida.");
}
export function requireRunInterval(now: number, lastRunAt: number | null): void {
  if (lastRunAt !== null && now - lastRunAt < 250) throw new Error("Espera un momento antes de ejecutar otra vez.");
}
