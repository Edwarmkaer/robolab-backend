import { describe, expect, it } from "vitest";
import { normalizeText, questionIssues } from "./rules";

const valid = { prompt: "¿Qué animal dice miau?", options: ["Gato", "Perro"], correctOption: 0, points: 1 };

describe("reglas de las preguntas", () => {
  it("una pregunta completa no tiene observaciones", () => {
    expect(questionIssues([valid])).toEqual([]);
  });

  it("ubica cada problema en su campo, para marcarlo en el formulario", () => {
    const issues = questionIssues([
      valid,
      { prompt: "   ", options: ["Sí", " sí ", ""], correctOption: 5, points: 0 },
    ]);
    expect(issues.map(({ question, field, option }) => [question, field, option])).toEqual([
      [1, "prompt", undefined],
      [1, "option", 1],
      [1, "option", 2],
      [1, "correct", undefined],
      [1, "points", undefined],
    ]);
    expect(issues.find((i) => i.option === 1)?.summary).toBe("hay alternativas repetidas.");
  });

  it("revisa la cantidad de alternativas y los largos máximos", () => {
    const issues = questionIssues([{ ...valid, prompt: "x".repeat(201), options: ["Sí"], points: 1.5 }]);
    expect(issues.map((i) => i.field)).toEqual(["prompt", "options", "points"]);
  });

  it("ordena los espacios del texto", () => {
    expect(normalizeText("  ¿Qué   animal?  ")).toBe("¿Qué animal?");
  });
});
