import { describe, expect, it } from "vitest";
import { type PlayRow, summarizeChallenge, summarizeStudent } from "./challengeStats";

const RETO = "primaria-mesa";

const play = (studentId: string, solved: boolean, runs: number, hints: number, ms: number, createdAt = 1): PlayRow => ({
  studentId,
  challengeId: RETO,
  solved,
  runs,
  hints,
  ms,
  createdAt,
});

const STUDENTS = [
  { studentId: "s1", displayName: "Pingüino veloz" },
  { studentId: "s2", displayName: "Zorro curioso" },
  { studentId: "s3", displayName: "Cóndor azul" },
  { studentId: "s4", displayName: "Vicuña sabia" },
  { studentId: "s5", displayName: "Puma rápido" },
];

describe("resultados de un reto en la clase (T9)", () => {
  it("calcula promedios, estados y lo observado con partidas resueltas (como las registra la web)", () => {
    // Las cifras son las de la maqueta T9: 80 %, 2,0 intentos, 0,8 pistas, 4:12.
    const plays = [
      play("s1", true, 2, 0, 190_000),
      play("s2", true, 3, 2, 400_000),
      play("s3", true, 1, 0, 115_000),
      play("s4", true, 2, 1, 302_000),
    ];
    const summary = summarizeChallenge(STUDENTS, plays);
    expect(summary).toMatchObject({
      studentCount: 5,
      studentsSolved: 4,
      solvedPercent: 80,
      avgTries: 2,
      avgHints: 0.8,
      avgMs: 251_750,
      observed: { hintsUsed: 2, hintsTotal: 4, correctedAlone: 1, correctedTotal: 3 },
    });
    expect(summary.rows).toEqual([
      { studentId: "s1", displayName: "Pingüino veloz", tries: 2, hints: 0, ms: 190_000, status: "solved" },
      { studentId: "s2", displayName: "Zorro curioso", tries: 3, hints: 2, ms: 400_000, status: "solved" },
      { studentId: "s3", displayName: "Cóndor azul", tries: 1, hints: 0, ms: 115_000, status: "solved" },
      { studentId: "s4", displayName: "Vicuña sabia", tries: 2, hints: 1, ms: 302_000, status: "solved" },
      { studentId: "s5", displayName: "Puma rápido", tries: 0, hints: 0, ms: 0, status: "not_started" },
    ]);
  });

  it("si también llegan partidas falladas, suma las ejecuciones hasta la primera resuelta e ignora las de después", () => {
    const plays = [
      // Corrigió solo: falló una partida entera y resolvió sin pistas.
      play("s1", false, 2, 0, 60_000, 1),
      play("s1", true, 1, 0, 30_000, 2),
      play("s1", true, 5, 3, 90_000, 3), // volvió a jugar después de lograrlo: no cambia nada
      // Falló la primera, resolvió con pista: no cuenta como "solo".
      play("s2", false, 1, 0, 20_000, 1),
      play("s2", true, 2, 1, 50_000, 2),
      // Solo falló: en curso, y el tiempo es el total que lleva.
      play("s3", false, 3, 1, 40_000, 1),
      play("s3", false, 2, 0, 35_000, 2),
      // Lo logró a la primera ejecución: no falló nunca.
      play("s4", true, 1, 0, 25_000, 1),
    ];
    const summary = summarizeChallenge(STUDENTS, plays);
    expect(summary.rows).toEqual([
      { studentId: "s1", displayName: "Pingüino veloz", tries: 3, hints: 0, ms: 30_000, status: "solved" },
      { studentId: "s2", displayName: "Zorro curioso", tries: 3, hints: 1, ms: 50_000, status: "solved" },
      { studentId: "s3", displayName: "Cóndor azul", tries: 5, hints: 1, ms: 75_000, status: "in_progress" },
      { studentId: "s4", displayName: "Vicuña sabia", tries: 1, hints: 0, ms: 25_000, status: "solved" },
      { studentId: "s5", displayName: "Puma rápido", tries: 0, hints: 0, ms: 0, status: "not_started" },
    ]);
    expect(summary).toMatchObject({
      studentsSolved: 3,
      solvedPercent: 60,
      avgTries: 3,
      avgHints: 0.5,
      avgMs: 45_000,
      observed: { hintsUsed: 2, hintsTotal: 4, correctedAlone: 1, correctedTotal: 3 },
    });
  });

  it("sin partidas no hay promedios (null), no ceros que engañen", () => {
    expect(summarizeChallenge(STUDENTS, [])).toMatchObject({
      studentCount: 5,
      studentsSolved: 0,
      solvedPercent: 0,
      avgTries: null,
      avgHints: null,
      avgMs: null,
      observed: { hintsUsed: 0, hintsTotal: 0, correctedAlone: 0, correctedTotal: 0 },
    });
    expect(summarizeChallenge([], [])).toMatchObject({ studentCount: 0, solvedPercent: 0, rows: [] });
  });

  it("ignora partidas de alumnos que ya no están en la clase y de otros retos", () => {
    const plays = [play("fantasma", true, 1, 0, 1000), { ...play("s1", true, 1, 0, 1000), challengeId: "otro" }];
    expect(summarizeChallenge(STUDENTS, plays, RETO)).toMatchObject({ studentsSolved: 0, avgTries: null });
  });
});

describe("avance de un alumno en los retos de la clase (T8)", () => {
  const assigned = ["r1", "r2", "r3"];
  const p = (challengeId: string, solved: boolean, createdAt: number): PlayRow => ({
    studentId: "s1",
    challengeId,
    solved,
    runs: 1,
    hints: 0,
    ms: 1000,
    createdAt,
  });

  it("cuenta los retos logrados, el último jugado y el estado", () => {
    expect(summarizeStudent(assigned, [p("r1", true, 1), p("r2", false, 2)])).toEqual({
      retosHechos: 1,
      retosTotal: 3,
      lastChallengeId: "r2",
      status: "in_progress",
    });
    expect(summarizeStudent(assigned, [p("r1", true, 3), p("r2", true, 1), p("r3", true, 2)])).toEqual({
      retosHechos: 3,
      retosTotal: 3,
      lastChallengeId: "r1",
      status: "solved",
    });
    expect(summarizeStudent(assigned, [])).toEqual({ retosHechos: 0, retosTotal: 3, lastChallengeId: null, status: "not_started" });
  });

  it("un reto resuelto dos veces cuenta una, y los retos no asignados no cuentan", () => {
    expect(summarizeStudent(assigned, [p("r1", true, 1), p("r1", true, 2), p("libre", true, 3)])).toEqual({
      retosHechos: 1,
      retosTotal: 3,
      lastChallengeId: "r1",
      status: "in_progress",
    });
    expect(summarizeStudent([], [p("libre", true, 3)])).toEqual({ retosHechos: 0, retosTotal: 0, lastChallengeId: null, status: "not_started" });
  });
});
