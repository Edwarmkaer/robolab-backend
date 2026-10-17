/**
 * Ranking de una evaluación (solo lo ve el docente).
 *
 * El alumno puede rendirla varias veces. De cada uno cuenta el primer intento
 * en que logró su mejor puntaje, y se ordena así:
 *   1. más puntaje;
 *   2. menos veces rendida hasta lograr ese puntaje;
 *   3. menos intentos de ejecutar el programa en ese intento;
 *   4. menos tiempo en ese intento.
 * Si todo empata, comparten el puesto.
 */

export type FinishedAttempt = {
  /** Número de vez que rindió la evaluación (1, 2, 3…). */
  readonly number: number;
  readonly score: number;
  readonly percent: number;
  /** Veces que tocó "Ejecutar" en todo el intento. */
  readonly runs: number;
  readonly totalMs: number;
};

export type Best = {
  readonly attempt: FinishedAttempt;
  /** Veces que necesitó hasta lograr su mejor puntaje. */
  readonly tries: number;
  readonly totalTries: number;
};

export function bestOf(attempts: readonly FinishedAttempt[]): Best | null {
  if (attempts.length === 0) return null;
  const ordered = [...attempts].sort((a, b) => a.number - b.number);
  const top = Math.max(...ordered.map((a) => a.score));
  const first = ordered.find((a) => a.score === top)!;
  return { attempt: first, tries: first.number, totalTries: ordered.length };
}

const compare = (a: Best, b: Best) =>
  b.attempt.score - a.attempt.score ||
  a.tries - b.tries ||
  a.attempt.runs - b.attempt.runs ||
  a.attempt.totalMs - b.attempt.totalMs;

export type Ranked<Id> = Best & { readonly studentId: Id; readonly position: number };

export function rankStudents<Id>(students: readonly { studentId: Id; attempts: readonly FinishedAttempt[] }[]): Ranked<Id>[] {
  const withBest = students.flatMap((s) => {
    const best = bestOf(s.attempts);
    return best ? [{ studentId: s.studentId, ...best }] : [];
  });
  withBest.sort(compare);
  return withBest.map((row, i) => {
    // Puesto de competencia: los empatados comparten el número y el siguiente salta.
    const firstTied = withBest.findIndex((other) => compare(other, row) === 0);
    return { ...row, position: (firstTied === -1 ? i : firstTied) + 1 };
  });
}
