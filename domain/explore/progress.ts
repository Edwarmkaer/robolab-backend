/**
 * Avance del modo abierto. Se guarda en el dispositivo (sin cuenta), así que
 * la lectura desconfía de lo guardado: si está dañado o es de otra versión,
 * se empieza de cero en vez de romper la pantalla.
 */
import { MISSIONS, missionsFor } from "../lab/mission";
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

/**
 * Lo que se juega en el modo abierto: los retos de bloques de Inicial y las
 * misiones de Primaria. Los retos de bloques de Primaria ya no se listan (ese
 * nivel juega misiones), así que no cuentan en el avance.
 */
export const openChallenges = (): readonly Challenge[] => CHALLENGES.filter((c) => c.level !== "primaria");

/** Ids de lo que se puede jugar en un tópico, en el orden de las listas. */
export const openIds = (topic: Topic): string[] => [
  ...openChallenges()
    .filter((c) => c.topic === topic)
    .map((c) => c.id),
  ...missionsFor(topic).map((m) => m.id),
];

export function topicProgress(progress: ExploreProgress, topic: Topic): { solved: number; total: number } {
  const ids = openIds(topic);
  return { solved: ids.filter((id) => progress.records[id]?.solved).length, total: ids.length };
}

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
    const known = new Set([...CHALLENGES.map((c) => c.id), ...MISSIONS.map((m) => m.id)]);
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
