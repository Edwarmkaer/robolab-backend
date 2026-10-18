import { describe, expect, it } from "vitest";
import { TOTAL, addFinishedAttempt, addPlay, counters, emptyDay, limaDay, summarize } from "./summary";

describe("día en hora de Perú", () => {
  it("a las 11 de la noche de Lima todavía es el mismo día, aunque en UTC ya sea mañana", () => {
    expect(limaDay(Date.UTC(2026, 9, 18, 3, 59))).toBe("2026-10-17"); // 22:59 en Lima
    expect(limaDay(Date.UTC(2026, 9, 18, 5, 0))).toBe("2026-10-18"); // 00:00 en Lima
  });
});

describe("cuentas de impacto", () => {
  it("suma partidas, resueltas, pistas y dispositivos nuevos", () => {
    let day = emptyDay("2026-10-17");
    day = addPlay(day, { solved: false, hints: 1, runs: 3, ms: 40_000 }, true);
    day = addPlay(day, { solved: true, hints: 2, runs: 4, ms: 90_000 }, false);
    day = addPlay(day, { solved: true, hints: 0, runs: 2, ms: 30_000 }, true);
    expect(day).toMatchObject({ plays: 3, solved: 2, withHints: 2, withHintsSolved: 1, runsSolved: 6, msSolved: 120_000, devices: 2 });

    const c = counters(day);
    expect(c.successRate).toBe(67);
    expect(c.avgRunsToSolve).toBe(3);
    expect(c.avgMinutesToSolve).toBe(1);
    expect(c.hintsHelped).toBe(50);
  });

  it("sin datos, las tasas son null (no 0 %, que mentiría)", () => {
    const c = counters(emptyDay(TOTAL));
    expect(c).toMatchObject({ plays: 0, successRate: null, avgRunsToSolve: null, avgMinutesToSolve: null, hintsHelped: null });
  });

  it("una evaluación terminada cuenta al alumno solo la primera vez en el día", () => {
    let day = emptyDay("2026-10-17");
    day = addFinishedAttempt(day, true);
    day = addFinishedAttempt(day, false);
    expect(day).toMatchObject({ attemptsFinished: 2, students: 1 });
  });

  it("resume total y hoy, aun sin filas guardadas", () => {
    const s = summarize(null, null, "2026-10-17");
    expect(s.today).toBe("2026-10-17");
    expect(s.total.plays).toBe(0);
    expect(s.todayStats.devices).toBe(0);
  });
});
