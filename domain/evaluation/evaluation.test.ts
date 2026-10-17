import { describe, expect, it } from "vitest";
import {
  ACCESS_CODE_ALPHABET,
  generateAccessCode,
  generateSessionToken,
  isValidAccessCode,
  normalizeAccessCode,
} from "./accessCode";
import { addDays, isCalendarDate, localCalendarDate, shortLabel } from "./calendar";
import { ScoringError, formatDuration, gradeAnswer, gradeEvaluation } from "./scoring";

describe("gradeEvaluation", () => {
  const keys = [
    { questionId: "q1", correctOption: 0, points: 2 },
    { questionId: "q2", correctOption: 1, points: 3 },
  ];

  it("suma puntos de las correctas y mide tiempos", () => {
    const result = gradeEvaluation(
      keys,
      [
        { questionId: "q1", chosenOption: 0, shownAt: 1_000, answeredAt: 4_000 },
        { questionId: "q2", chosenOption: 2, shownAt: 10_000, answeredAt: 11_000 },
      ],
      0,
      20_000,
    );
    expect(result).toMatchObject({
      score: 2,
      maxScore: 5,
      correctCount: 1,
      questionCount: 2,
      percent: 40,
      totalMs: 20_000,
      averageResponseMs: 2_000,
    });
    expect(result.answers.map((a) => a.responseMs)).toEqual([3_000, 1_000]);
  });

  it("una pregunta sin responder cuenta en el máximo, no en la nota", () => {
    const result = gradeEvaluation(keys, [], 0, 1_000);
    expect(result).toMatchObject({ score: 0, maxScore: 5, percent: 0, averageResponseMs: 0 });
  });

  it("rechaza tiempos imposibles", () => {
    expect(() =>
      gradeAnswer(keys[0]!, { questionId: "q1", chosenOption: 0, shownAt: 5, answeredAt: 4 }),
    ).toThrowError(ScoringError);
    expect(() => gradeEvaluation(keys, [], 10, 5)).toThrowError(ScoringError);
  });

  it("no mezcla respuestas de otra pregunta", () => {
    expect(() =>
      gradeAnswer(keys[0]!, { questionId: "q2", chosenOption: 0, shownAt: 0, answeredAt: 1 }),
    ).toThrowError(/no corresponde/);
  });
});

describe("formatDuration", () => {
  it.each([
    [0, "0 s"],
    [42_400, "42 s"],
    [65_000, "1 min 05 s"],
    [-5, "0 s"],
  ])("%s ms → %s", (ms, text) => expect(formatDuration(ms)).toBe(text));
});

describe("códigos de acceso", () => {
  it("genera 6 caracteres del alfabeto sin ambigüedades", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateAccessCode();
      expect(isValidAccessCode(code)).toBe(true);
    }
    expect(ACCESS_CODE_ALPHABET).not.toMatch(/[01OIL]/);
  });

  it("descarta bytes sesgados y sigue pidiendo azar", () => {
    let call = 0;
    const random = (n: number) => new Uint8Array(n).fill(call++ === 0 ? 255 : 0);
    expect(generateAccessCode(random)).toBe("AAAAAA");
  });

  it("normaliza lo que escribe un niño", () => {
    expect(normalizeAccessCode(" ab-c 2d3 ")).toBe("ABC2D3");
    expect(isValidAccessCode("ABC2D")).toBe(false);
    expect(isValidAccessCode("ABC2D0")).toBe(false);
  });

  it("los tokens de sesión son hexadecimales de 64 caracteres y distintos", () => {
    const a = generateSessionToken();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(generateSessionToken()).not.toBe(a);
  });
});

describe("calendario", () => {
  it("valida fechas reales", () => {
    expect(isCalendarDate("2026-10-17")).toBe(true);
    expect(isCalendarDate("2026-02-30")).toBe(false);
    expect(isCalendarDate("17/10/2026")).toBe(false);
  });

  it("usa la fecha local del dispositivo", () => {
    expect(localCalendarDate(new Date(2026, 9, 17, 23, 59))).toBe("2026-10-17");
  });

  it("etiqueta corta para gráficos", () => {
    expect(shortLabel("2026-10-17")).toBe("17 oct");
  });

  it("suma y resta días cruzando meses y años", () => {
    expect(addDays("2026-10-17", -21)).toBe("2026-09-26");
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
    expect(() => addDays("2026-02-30", 1)).toThrow();
  });
});
