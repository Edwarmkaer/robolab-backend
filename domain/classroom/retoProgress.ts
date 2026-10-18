/**
 * Progreso de una clase reto por reto (pestaña Progreso del docente). Es el
 * mismo cálculo de `challengeStats`, puesto en fila: una columna por reto
 * asignado, en el orden en que se asignó, y una fila por alumno. Solo cuenta lo
 * observable (logró, ejecuciones, pistas, tiempo); no diagnostica.
 */
import { type ChallengeStatus, type PlayRow, type StudentRef, summarizeChallenge } from "./challengeStats";

/** Un reto asignado a la clase, con lo mínimo para ordenarlo y nombrarlo. */
export type RetoRef = {
  readonly assignmentId: string;
  readonly challengeId: string;
  readonly title: string;
  readonly createdAt: number;
};

export type RetoColumn = RetoRef & {
  /** Porcentaje entero de la clase que lo logró. */
  readonly solvedPercent: number;
  /** Promedios entre quienes jugaron; null si nadie jugó. */
  readonly avgTries: number | null;
  readonly avgHints: number | null;
  readonly avgMs: number | null;
  /** Alumnos que jugaron el reto (lo lograran o no). */
  readonly playedCount: number;
};

export type RetoCell = {
  readonly challengeId: string;
  readonly status: ChallengeStatus;
  /** Null mientras no haya jugado: un 0 se leería como un dato. */
  readonly tries: number | null;
  readonly hints: number | null;
  readonly ms: number | null;
};

export type StudentRetoRow = {
  readonly studentId: string;
  readonly displayName: string;
  /** Una celda por reto, en el mismo orden que `retos`. */
  readonly cells: readonly RetoCell[];
};

export type AttentionKind = "unsolved_streak" | "not_started";

export type Attention = {
  readonly studentId: string;
  readonly displayName: string;
  readonly kind: AttentionKind;
  /** unsolved_streak: retos jugados seguidos sin lograr. not_started: retos que aún no empieza. */
  readonly count: number;
};

export type RetoProgress = {
  readonly retos: readonly RetoColumn[];
  readonly students: readonly StudentRetoRow[];
  readonly attention: readonly Attention[];
};

/** Desde cuántos retos jugados seguidos sin lograr se avisa al docente. */
export const STREAK_UNSOLVED = 2;
/** Desde cuántos retos sin empezar se avisa al docente. */
export const MIN_NOT_STARTED = 3;

const byName = (a: { displayName: string }, b: { displayName: string }) => a.displayName.localeCompare(b.displayName, "es");

/** Retos jugados seguidos sin lograr, contando desde el último que jugó (los que no empezó no cuentan ni cortan). */
function unsolvedStreak(cells: readonly RetoCell[]): number {
  const played = cells.filter((c) => c.status !== "not_started");
  let streak = 0;
  for (let i = played.length - 1; i >= 0 && played[i]!.status === "in_progress"; i--) streak++;
  return streak;
}

export function summarizeRetoProgress(
  retos: readonly RetoRef[],
  students: readonly StudentRef[],
  plays: readonly PlayRow[],
): RetoProgress {
  const ordered = [...retos].sort((a, b) => a.createdAt - b.createdAt);
  const summaries = ordered.map((r) => summarizeChallenge(students, plays, r.challengeId));

  const columns: RetoColumn[] = ordered.map((r, i) => {
    const s = summaries[i]!;
    return {
      ...r,
      solvedPercent: s.solvedPercent,
      avgTries: s.avgTries,
      avgHints: s.avgHints,
      avgMs: s.avgMs,
      playedCount: s.rows.filter((row) => row.status !== "not_started").length,
    };
  });

  const rows: StudentRetoRow[] = students
    .map((student) => ({
      studentId: student.studentId,
      displayName: student.displayName,
      cells: ordered.map((r, i): RetoCell => {
        const row = summaries[i]!.rows.find((x) => x.studentId === student.studentId)!;
        const played = row.status !== "not_started";
        return {
          challengeId: r.challengeId,
          status: row.status,
          tries: played ? row.tries : null,
          hints: played ? row.hints : null,
          ms: played ? row.ms : null,
        };
      }),
    }))
    .sort(byName);

  const attention: Attention[] = rows.flatMap((row): Attention[] => {
    const found: Attention[] = [];
    const streak = unsolvedStreak(row.cells);
    if (streak >= STREAK_UNSOLVED) found.push({ studentId: row.studentId, displayName: row.displayName, kind: "unsolved_streak", count: streak });
    const notStarted = row.cells.filter((c) => c.status === "not_started").length;
    if (notStarted >= MIN_NOT_STARTED) found.push({ studentId: row.studentId, displayName: row.displayName, kind: "not_started", count: notStarted });
    return found;
  });

  return { retos: columns, students: rows, attention };
}
