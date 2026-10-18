/**
 * Lo que el docente ve de los retos de su clase (T8, T8b, T9), calculado a
 * partir de las partidas que el servidor verificó. Solo cuenta lo observable
 * (ejecuciones, pistas, tiempo); no diagnostica.
 *
 * Una partida es lo que la web registra al terminar un reto: cuántas veces se
 * tocó "Ejecutar" (`runs`), cuántas pistas pidió y cuánto tardó. Hoy la web
 * registra la partida cuando el reto se resuelve; si algún día registra también
 * las falladas, las cuentas siguen valiendo: se miran las partidas hasta la
 * primera resuelta (las de después son repaso) y se suman sus ejecuciones.
 */

export type PlayRow = {
  readonly studentId: string;
  readonly challengeId: string;
  readonly solved: boolean;
  /** Veces que tocó "Ejecutar" en esa partida. */
  readonly runs: number;
  readonly hints: number;
  readonly ms: number;
  readonly createdAt: number;
};

export type StudentRef = { readonly studentId: string; readonly displayName: string };

export type ChallengeStatus = "solved" | "in_progress" | "not_started";

export type StudentChallengeRow = {
  readonly studentId: string;
  readonly displayName: string;
  /** Ejecuciones hasta lograrlo (o hasta ahora, si no lo logró). */
  readonly tries: number;
  readonly hints: number;
  /** Tiempo de la partida en que lo logró; si no lo logró, el total que lleva. */
  readonly ms: number;
  readonly status: ChallengeStatus;
};

export type Observed = {
  /** Alumnos que pidieron al menos una pista, de los que jugaron. */
  readonly hintsUsed: number;
  readonly hintsTotal: number;
  /** Alumnos que fallaron al primer intento y después lo lograron sin pistas, de los que fallaron al primer intento. */
  readonly correctedAlone: number;
  readonly correctedTotal: number;
};

export type ChallengeSummary = {
  readonly studentCount: number;
  readonly studentsSolved: number;
  /** Porcentaje entero de la clase que lo logró. */
  readonly solvedPercent: number;
  /** Promedios entre quienes jugaron (un decimal; ms entero); null si nadie jugó. */
  readonly avgTries: number | null;
  readonly avgHints: number | null;
  readonly avgMs: number | null;
  readonly rows: readonly StudentChallengeRow[];
  readonly observed: Observed;
};

type StudentFacts = {
  readonly tries: number;
  readonly hints: number;
  readonly ms: number;
  readonly status: ChallengeStatus;
  /** La primera ejecución no llegó: falló una partida entera o necesitó más de una ejecución. */
  readonly failedFirst: boolean;
};

const byTime = (a: PlayRow, b: PlayRow) => a.createdAt - b.createdAt;

/** Resume las partidas de un alumno en un reto. */
function studentFacts(plays: readonly PlayRow[]): StudentFacts {
  const ordered = [...plays].sort(byTime);
  const firstSolved = ordered.findIndex((p) => p.solved);
  const counted = firstSolved === -1 ? ordered : ordered.slice(0, firstSolved + 1);
  const first = counted[0];
  const tries = counted.reduce((sum, p) => sum + p.runs, 0);
  const hints = counted.reduce((sum, p) => sum + p.hints, 0);
  const ms = firstSolved === -1 ? counted.reduce((sum, p) => sum + p.ms, 0) : counted[firstSolved]!.ms;
  return {
    tries,
    hints,
    ms,
    status: firstSolved !== -1 ? "solved" : counted.length > 0 ? "in_progress" : "not_started",
    failedFirst: first !== undefined && (!first.solved || first.runs > 1),
  };
}

const tenth = (n: number) => Math.round(n * 10) / 10;
const percent = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part / whole) * 100));

/**
 * Resultados de un reto para una clase. Solo cuenta las partidas de ese reto
 * (`challengeId`, si se pasa) y de alumnos que siguen en la clase.
 */
export function summarizeChallenge(
  students: readonly StudentRef[],
  plays: readonly PlayRow[],
  challengeId?: string,
): ChallengeSummary {
  const byStudent = new Map<string, PlayRow[]>();
  for (const play of plays) {
    if (challengeId !== undefined && play.challengeId !== challengeId) continue;
    byStudent.set(play.studentId, [...(byStudent.get(play.studentId) ?? []), play]);
  }
  const facts = students.map((s) => ({ ...s, ...studentFacts(byStudent.get(s.studentId) ?? []) }));
  const rows: StudentChallengeRow[] = facts.map(({ studentId, displayName, tries, hints, ms, status }) => ({
    studentId,
    displayName,
    tries,
    hints,
    ms,
    status,
  }));

  const played = facts.filter((f) => f.status !== "not_started");
  const solved = facts.filter((f) => f.status === "solved");
  const failedFirst = facts.filter((f) => f.failedFirst);
  const avg = (pick: (f: StudentFacts) => number) =>
    played.length === 0 ? null : played.reduce((sum, f) => sum + pick(f), 0) / played.length;
  const avgTries = avg((f) => f.tries);
  const avgHints = avg((f) => f.hints);
  const avgMs = avg((f) => f.ms);

  return {
    studentCount: students.length,
    studentsSolved: solved.length,
    solvedPercent: percent(solved.length, students.length),
    avgTries: avgTries === null ? null : tenth(avgTries),
    avgHints: avgHints === null ? null : tenth(avgHints),
    avgMs: avgMs === null ? null : Math.round(avgMs),
    rows,
    observed: {
      hintsUsed: played.filter((f) => f.hints > 0).length,
      hintsTotal: played.length,
      correctedAlone: failedFirst.filter((f) => f.status === "solved" && f.hints === 0).length,
      correctedTotal: failedFirst.length,
    },
  };
}

export type StudentProgress = {
  readonly retosHechos: number;
  readonly retosTotal: number;
  /** El reto de su partida más reciente entre los asignados; null si no jugó ninguno. */
  readonly lastChallengeId: string | null;
  readonly status: ChallengeStatus;
};

/** Avance de un alumno sobre los retos asignados a su clase (fila de T8). */
export function summarizeStudent(assignedChallengeIds: readonly string[], plays: readonly PlayRow[]): StudentProgress {
  const assigned = new Set(assignedChallengeIds);
  const own = plays.filter((p) => assigned.has(p.challengeId)).sort(byTime);
  const solved = new Set(own.filter((p) => p.solved).map((p) => p.challengeId));
  const retosTotal = assigned.size;
  return {
    retosHechos: solved.size,
    retosTotal,
    lastChallengeId: own.at(-1)?.challengeId ?? null,
    status: retosTotal > 0 && solved.size === retosTotal ? "solved" : own.length > 0 ? "in_progress" : "not_started",
  };
}
