import { describe, expect, it } from "vitest";
import { type FinishedAttempt, bestOf, rankStudents } from "./ranking";

const attempt = (number: number, score: number, runs = 3, totalMs = 60_000): FinishedAttempt => ({
  number,
  score,
  percent: score * 10,
  runs,
  totalMs,
});

describe("mejor intento de un alumno", () => {
  it("es el primero en que logró su mejor puntaje; las veces son las que necesitó para llegar ahí", () => {
    const best = bestOf([attempt(1, 6), attempt(2, 8), attempt(3, 10, 5), attempt(4, 10, 2)]);
    expect(best).toMatchObject({ attempt: { number: 3, score: 10, runs: 5 }, tries: 3, totalTries: 4 });
  });

  it("sin intentos terminados no hay mejor intento", () => {
    expect(bestOf([])).toBeNull();
  });
});

describe("ranking de una evaluación", () => {
  const positions = (rows: ReturnType<typeof rankStudents>) => rows.map((r) => [r.studentId, r.position]);

  it("gana el mejor puntaje aunque lo haya intentado más veces", () => {
    const ranked = rankStudents([
      { studentId: "ana", attempts: [attempt(1, 8)] },
      { studentId: "beto", attempts: [attempt(1, 6), attempt(2, 8), attempt(3, 10)] },
    ]);
    expect(positions(ranked)).toEqual([
      ["beto", 1],
      ["ana", 2],
    ]);
  });

  it("con el mismo puntaje va arriba quien lo rindió menos veces", () => {
    const ranked = rankStudents([
      { studentId: "beto", attempts: [attempt(1, 6), attempt(2, 8)] },
      { studentId: "ana", attempts: [attempt(1, 8, 9, 300_000)] },
    ]);
    expect(positions(ranked)).toEqual([
      ["ana", 1],
      ["beto", 2],
    ]);
  });

  it("después desempatan menos intentos de ejecutar y luego menos tiempo", () => {
    const ranked = rankStudents([
      { studentId: "lenta", attempts: [attempt(1, 10, 3, 90_000)] },
      { studentId: "muchos", attempts: [attempt(1, 10, 6, 30_000)] },
      { studentId: "rapida", attempts: [attempt(1, 10, 3, 40_000)] },
    ]);
    expect(positions(ranked)).toEqual([
      ["rapida", 1],
      ["lenta", 2],
      ["muchos", 3],
    ]);
  });

  it("un empate total comparte el puesto y el siguiente salta", () => {
    const ranked = rankStudents([
      { studentId: "a", attempts: [attempt(1, 10)] },
      { studentId: "b", attempts: [attempt(1, 10)] },
      { studentId: "c", attempts: [attempt(1, 9)] },
    ]);
    expect(ranked.map((r) => r.position)).toEqual([1, 1, 3]);
  });

  it("quien no terminó ningún intento no entra al ranking", () => {
    expect(rankStudents([{ studentId: "a", attempts: [] }])).toEqual([]);
  });
});
