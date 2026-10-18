import { describe, expect, it } from "vitest";
import type { PlayRow } from "./challengeStats";
import { MIN_NOT_STARTED, STREAK_UNSOLVED, summarizeRetoProgress } from "./retoProgress";

const RETOS = [
  { assignmentId: "a1", challengeId: "r1", title: "Secuencias", createdAt: 1 },
  { assignmentId: "a2", challengeId: "r2", title: "Bucles", createdAt: 2 },
  { assignmentId: "a3", challengeId: "r3", title: "Condiciones", createdAt: 3 },
  { assignmentId: "a4", challengeId: "r4", title: "Sensores", createdAt: 4 },
];

const STUDENTS = [
  { studentId: "ana", displayName: "Ana" },
  { studentId: "teo", displayName: "Teo" },
  { studentId: "sol", displayName: "Sol" },
];

let clock = 0;
const play = (studentId: string, challengeId: string, solved: boolean, runs: number, hints = 0, ms = 60_000): PlayRow => ({
  studentId,
  challengeId,
  solved,
  runs,
  hints,
  ms,
  createdAt: ++clock,
});

describe("progreso de la clase reto por reto", () => {
  it("ordena los retos como se asignaron y trae un resumen de la clase por cada uno", () => {
    const shuffled = [RETOS[2]!, RETOS[0]!, RETOS[3]!, RETOS[1]!];
    const plays = [play("ana", "r1", true, 2), play("teo", "r1", true, 5), play("ana", "r2", true, 2)];
    const { retos } = summarizeRetoProgress(shuffled, STUDENTS, plays);
    expect(retos.map((r) => r.title)).toEqual(["Secuencias", "Bucles", "Condiciones", "Sensores"]);
    expect(retos[0]).toMatchObject({ assignmentId: "a1", challengeId: "r1", solvedPercent: 67, avgTries: 3.5, playedCount: 2 });
    // «Bucles»: solo Ana jugó y lo logró.
    expect(retos[1]).toMatchObject({ solvedPercent: 33, avgTries: 2, playedCount: 1 });
  });

  it("sin partidas no inventa promedios: devuelve null y 0 %", () => {
    const { retos } = summarizeRetoProgress(RETOS, STUDENTS, []);
    expect(retos[2]).toMatchObject({ solvedPercent: 0, avgTries: null, avgHints: null, avgMs: null, playedCount: 0 });
  });

  it("da una fila por alumno, por apodo, con una celda por reto en el orden de los retos", () => {
    const plays = [
      play("ana", "r1", true, 2, 1, 90_000),
      play("teo", "r1", false, 4, 2, 120_000),
    ];
    const { students } = summarizeRetoProgress(RETOS, STUDENTS, plays);
    expect(students.map((s) => s.displayName)).toEqual(["Ana", "Sol", "Teo"]);
    const ana = students[0]!;
    expect(ana.cells).toHaveLength(4);
    expect(ana.cells[0]).toEqual({ challengeId: "r1", status: "solved", tries: 2, hints: 1, ms: 90_000 });
    // Lo que no jugó queda sin cifras: no se muestra un 0 que parezca un dato.
    expect(ana.cells[1]).toEqual({ challengeId: "r2", status: "not_started", tries: null, hints: null, ms: null });
    expect(students[2]!.cells[0]).toMatchObject({ status: "in_progress", tries: 4, hints: 2, ms: 120_000 });
  });

  it("ignora partidas de retos que la clase no tiene asignados", () => {
    const { students, retos } = summarizeRetoProgress(RETOS, STUDENTS, [play("ana", "otro-reto", true, 1)]);
    expect(students[0]!.cells.every((c) => c.status === "not_started")).toBe(true);
    expect(retos.every((r) => r.playedCount === 0)).toBe(true);
  });

  describe("para mirar de cerca (solo lo observable)", () => {
    it("marca a quien lleva retos seguidos jugados sin lograrlos", () => {
      const plays = [
        play("teo", "r1", true, 5),
        play("teo", "r2", false, 6),
        play("teo", "r3", false, 7),
      ];
      const { attention } = summarizeRetoProgress(RETOS, STUDENTS, plays);
      expect(STREAK_UNSOLVED).toBe(2);
      expect(attention).toContainEqual({ studentId: "teo", displayName: "Teo", kind: "unsolved_streak", count: 2 });
    });

    it("la racha cuenta desde el último reto jugado: si ya lo logró, no se marca", () => {
      const plays = [play("teo", "r1", false, 6), play("teo", "r2", false, 6), play("teo", "r3", true, 3)];
      const { attention } = summarizeRetoProgress(RETOS, STUDENTS, plays);
      expect(attention.some((a) => a.studentId === "teo" && a.kind === "unsolved_streak")).toBe(false);
    });

    it("un reto sin empezar entre medias no rompe ni inventa la racha", () => {
      const plays = [play("teo", "r1", false, 6), play("teo", "r3", false, 6)];
      const { attention } = summarizeRetoProgress(RETOS, STUDENTS, plays);
      expect(attention).toContainEqual({ studentId: "teo", displayName: "Teo", kind: "unsolved_streak", count: 1 + 1 });
    });

    it("marca a quien aún no empieza varios retos", () => {
      const plays = [play("ana", "r1", true, 2), play("ana", "r2", true, 2)];
      const { attention } = summarizeRetoProgress(RETOS, STUDENTS, plays);
      expect(MIN_NOT_STARTED).toBe(3);
      expect(attention).toContainEqual({ studentId: "sol", displayName: "Sol", kind: "not_started", count: 4 });
      expect(attention.some((a) => a.studentId === "ana")).toBe(false);
    });

    it("no marca a nadie si la clase tiene menos retos que el umbral", () => {
      const { attention } = summarizeRetoProgress(RETOS.slice(0, 2), STUDENTS, []);
      expect(attention).toEqual([]);
    });

    it("ordena por apodo y devuelve un aviso por tipo y alumno", () => {
      const plays = [play("teo", "r1", false, 6), play("teo", "r2", false, 6)];
      const { attention } = summarizeRetoProgress(RETOS, STUDENTS, plays);
      expect(attention.map((a) => `${a.displayName}:${a.kind}`)).toEqual(["Ana:not_started", "Sol:not_started", "Teo:unsolved_streak"]);
    });
  });
});
