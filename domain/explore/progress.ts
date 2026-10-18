/**
 * Avance del modo abierto. Se guarda en el dispositivo (sin cuenta), así que
 * la lectura desconfía de lo guardado: si está dañado o es de otra versión,
 * se empieza de cero en vez de romper la pantalla.
 */
import type { EducationLevel } from "../game/levels";
import { MISSIONS, type Mission } from "../lab/mission";
import { CHALLENGES, type Challenge, type Topic } from "./challenges";

export type PlayResult = {
  readonly solved: boolean;
  /** Veces que tocó "Ejecutar" (o casillas que probó, al predecir). */
  readonly runs: number;
  readonly hints: number;
  readonly ms: number;
};

export type ChallengeRecord = {
  readonly solved: boolean;
  readonly plays: number;
  /** El mejor intento resuelto: menos pistas, luego menos intentos y luego menos tiempo. */
  readonly best: Omit<PlayResult, "solved"> | null;
  readonly lastPlayedAt: number;
};

export type ExploreProgress = {
  readonly version: 1;
  readonly records: Readonly<Record<string, ChallengeRecord>>;
};

export const emptyProgress = (): ExploreProgress => ({ version: 1, records: {} });

/**
 * Lo que se juega en el modo abierto: los retos de bloques de Inicial y las
 * misiones de Primaria. Los retos de bloques de Primaria que quedan en
 * `CHALLENGES` son legado: no se listan ni cuentan en el avance.
 */
export const openChallenges = (): readonly Challenge[] => CHALLENGES.filter((c) => c.level !== "primaria");

/** Algo jugable del modo abierto que cuenta para el avance: un reto de bloques (Inicial) o una misión (Primaria). */
export type CatalogItem = Challenge | Mission;

/** Todo lo que se lista: primero los retos de bloques y luego las misiones, cada grupo en su orden. */
export const catalog = (): readonly CatalogItem[] => [...openChallenges(), ...MISSIONS];

export const catalogFor = (topic: Topic, level?: EducationLevel): readonly CatalogItem[] =>
  catalog().filter((item) => item.topic === topic && (level === undefined || item.level === level));

/** Ids de lo que se puede jugar en un tópico, en el orden de las listas. */
export const openIds = (topic: Topic): string[] => catalogFor(topic).map((item) => item.id);

const better = (a: Omit<PlayResult, "solved">, b: Omit<PlayResult, "solved">) =>
  a.hints - b.hints || a.runs - b.runs || a.ms - b.ms;

export function recordPlay(progress: ExploreProgress, challengeId: string, result: PlayResult, now: number): ExploreProgress {
  const previous = progress.records[challengeId];
  const attempt = { runs: result.runs, hints: result.hints, ms: result.ms };
  const best = !result.solved
    ? (previous?.best ?? null)
    : previous?.best && better(previous.best, attempt) <= 0
      ? previous.best
      : attempt;
  const record: ChallengeRecord = {
    solved: Boolean(previous?.solved) || result.solved,
    plays: (previous?.plays ?? 0) + 1,
    best,
    lastPlayedAt: now,
  };
  return { ...progress, records: { ...progress.records, [challengeId]: record } };
}

export type ProgressSummary = { readonly solved: number; readonly total: number };

const summarize = (progress: ExploreProgress, items: readonly CatalogItem[]): ProgressSummary => ({
  solved: items.filter((item) => progress.records[item.id]?.solved).length,
  total: items.length,
});

/** Cuántos resolvió de todo lo que hay en un tópico, retos y misiones (la tarjeta de inicio y "Mi avance"). */
export const topicProgress = (progress: ExploreProgress, topic: Topic): ProgressSummary => summarize(progress, catalogFor(topic));

/** Cuántos resolvió de un tópico en un nivel (la tarjeta de nivel). */
export const levelProgress = (progress: ExploreProgress, topic: Topic, level: EducationLevel): ProgressSummary =>
  summarize(progress, catalogFor(topic, level));

const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;

function parseRecord(value: unknown): ChallengeRecord | null {
  if (typeof value !== "object" || value === null) return null;
  const r = value as Record<string, unknown>;
  if (typeof r.solved !== "boolean" || !isNumber(r.plays) || !isNumber(r.lastPlayedAt)) return null;
  let best: ChallengeRecord["best"] = null;
  if (typeof r.best === "object" && r.best !== null) {
    const b = r.best as Record<string, unknown>;
    if (!isNumber(b.runs) || !isNumber(b.hints) || !isNumber(b.ms)) return null;
    best = { runs: b.runs, hints: b.hints, ms: b.ms };
  }
  return { solved: r.solved, plays: r.plays, best, lastPlayedAt: r.lastPlayedAt };
}

export function parseProgress(raw: string | null): ExploreProgress {
  if (!raw) return emptyProgress();
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== "object" || data === null || (data as { version?: unknown }).version !== 1) return emptyProgress();
    const known = new Set([...CHALLENGES.map((c) => c.id), ...MISSIONS.map((m) => m.id)]); // incluye el legado: lo ya jugado no se pierde
    const records: Record<string, ChallengeRecord> = {};
    for (const [id, value] of Object.entries((data as { records?: object }).records ?? {})) {
      const record = parseRecord(value);
      if (known.has(id) && record) records[id] = record;
    }
    return { version: 1, records };
  } catch {
    return emptyProgress();
  }
}
