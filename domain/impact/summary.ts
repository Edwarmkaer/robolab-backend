/**
 * Cifras públicas de impacto: cuánto se usa RoboLab y cómo le va a quien
 * juega. Se acumulan por día (hora de Perú) y en un total. Nunca guardan
 * nombres ni identificadores: solo cuentas.
 */

import { limaCalendarDate } from "../evaluation/calendar";

/** Fila que acumula todo desde el inicio. */
export const TOTAL = "total";

export type DayStats = {
  readonly day: string;
  readonly plays: number;
  readonly solved: number;
  /** Partidas que pidieron al menos una pista, y cuántas de esas se resolvieron. */
  readonly withHints: number;
  readonly withHintsSolved: number;
  /** Ejecuciones y milisegundos sumados solo de las partidas resueltas. */
  readonly runsSolved: number;
  readonly msSolved: number;
  /** Dispositivos distintos (identificador al azar, sin nombres). */
  readonly devices: number;
  /** Evaluaciones de clase terminadas y alumnos distintos que terminaron alguna. */
  readonly attemptsFinished: number;
  readonly students: number;
};

export type PlayFacts = {
  readonly solved: boolean;
  readonly hints: number;
  readonly runs: number;
  readonly ms: number;
};

export const limaDay = (instant: number): string => limaCalendarDate(instant);

export const emptyDay = (day: string): DayStats => ({
  day,
  plays: 0,
  solved: 0,
  withHints: 0,
  withHintsSolved: 0,
  runsSolved: 0,
  msSolved: 0,
  devices: 0,
  attemptsFinished: 0,
  students: 0,
});

export function addPlay(stats: DayStats, play: PlayFacts, newDevice: boolean): DayStats {
  const asked = play.hints > 0;
  return {
    ...stats,
    plays: stats.plays + 1,
    solved: stats.solved + (play.solved ? 1 : 0),
    withHints: stats.withHints + (asked ? 1 : 0),
    withHintsSolved: stats.withHintsSolved + (asked && play.solved ? 1 : 0),
    runsSolved: stats.runsSolved + (play.solved ? play.runs : 0),
    msSolved: stats.msSolved + (play.solved ? play.ms : 0),
    devices: stats.devices + (newDevice ? 1 : 0),
  };
}

export function addFinishedAttempt(stats: DayStats, newStudent: boolean): DayStats {
  return {
    ...stats,
    attemptsFinished: stats.attemptsFinished + 1,
    students: stats.students + (newStudent ? 1 : 0),
  };
}

/** Lo que se muestra en el panel. Las tasas son null cuando todavía no hay con qué calcularlas. */
export type Counters = {
  readonly plays: number;
  readonly solved: number;
  readonly devices: number;
  readonly attemptsFinished: number;
  readonly students: number;
  /** Porcentaje entero de partidas resueltas. */
  readonly successRate: number | null;
  /** Ejecuciones promedio hasta resolver un reto (un decimal). */
  readonly avgRunsToSolve: number | null;
  /** Minutos promedio hasta resolver un reto (un decimal). */
  readonly avgMinutesToSolve: number | null;
  /** Porcentaje entero de partidas con pista que terminaron resueltas. */
  readonly hintsHelped: number | null;
};

const percent = (part: number, whole: number) => (whole === 0 ? null : Math.round((part / whole) * 100));
const tenth = (part: number, whole: number) => (whole === 0 ? null : Math.round((part / whole) * 10) / 10);

export function counters(stats: DayStats): Counters {
  return {
    plays: stats.plays,
    solved: stats.solved,
    devices: stats.devices,
    attemptsFinished: stats.attemptsFinished,
    students: stats.students,
    successRate: percent(stats.solved, stats.plays),
    avgRunsToSolve: tenth(stats.runsSolved, stats.solved),
    avgMinutesToSolve: tenth(stats.msSolved / 60_000, stats.solved),
    hintsHelped: percent(stats.withHintsSolved, stats.withHints),
  };
}

export type ImpactSummary = {
  readonly today: string;
  readonly total: Counters;
  readonly todayStats: Counters;
};

export function summarize(total: DayStats | null, today: DayStats | null, todayDay: string): ImpactSummary {
  return {
    today: todayDay,
    total: counters(total ?? emptyDay(TOTAL)),
    todayStats: counters(today ?? emptyDay(todayDay)),
  };
}
