import { describe, expect, it } from "vitest";
import { CHALLENGES, challengesFor } from "../explore/challenges";
import { COMPETENCIES, EVALUATION_EVIDENCE, capacityText, coverage, evidenceFor } from "./competencias";

describe("competencias del CNEB en los retos", () => {
  it("todo reto evidencia la competencia 28 (entornos virtuales) y al menos una más", () => {
    for (const c of CHALLENGES) {
      const ids = evidenceFor(c).map((e) => e.competency);
      expect(ids, c.id).toContain(28);
      expect(new Set(ids).size, c.id).toBeGreaterThanOrEqual(2);
    }
  });

  it("corregir evidencia que monitorea y ajusta; eficiencia, que cuenta y expresa con Repetir", () => {
    expect(capacityText(evidenceFor({ kind: "fix", level: "primaria" }).find((e) => e.competency === 29)!)).toMatch(/Monitorea y ajusta/);
    expect(capacityText(evidenceFor({ kind: "efficient", level: "primaria" }).find((e) => e.competency === 23)!)).toMatch(/estimación y cálculo/);
    expect(evidenceFor({ kind: "efficient", level: "inicial" }).map((e) => e.competency)).not.toContain(22);
  });

  it("cada tópico suma la competencia de su área: Ciencia indaga (20), Ingeniería valida su solución (22) y Matemáticas cuenta (23)", () => {
    const expected = { ciencia: 20, ingenieria: 22, matematicas: 23 } as const;
    for (const [topic, id] of Object.entries(expected)) {
      const list = challengesFor(topic, "inicial");
      expect(list.length, topic).toBeGreaterThan(0);
      for (const c of list) expect(evidenceFor(c).map((e) => e.competency), c.id).toContain(id);
    }
    // Tecnología y Artes no suman competencia propia: solo lo que dice su tipo de reto.
    for (const topic of ["tecnologia", "artes"] as const) {
      for (const c of challengesFor(topic, "inicial")) expect(evidenceFor(c)).toEqual(evidenceFor({ kind: c.kind, level: c.level }));
    }
    expect(capacityText(evidenceFor({ kind: "predict", level: "inicial", topic: "ciencia" }).find((e) => e.competency === 20)!)).toBe(
      "Analiza datos e información",
    );
  });

  it("no repite una capacidad aunque el tipo y el tópico apunten a la misma", () => {
    for (const c of CHALLENGES) {
      const keys = evidenceFor(c).map((e) => `${e.competency}-${e.capacity}`);
      expect(new Set(keys).size, c.id).toBe(keys.length);
    }
  });

  it("cada capacidad citada existe en su competencia", () => {
    for (const c of CHALLENGES) {
      for (const e of evidenceFor(c)) expect(COMPETENCIES[e.competency].capacities[e.capacity], `${c.id} ${e.competency}`).toBeTruthy();
    }
    for (const e of EVALUATION_EVIDENCE) expect(capacityText(e)).toBeTruthy();
  });

  it("la cobertura cuenta, por competencia, cuántos de sus retos están resueltos", () => {
    const solved = new Set(CHALLENGES.filter((c) => c.kind === "sequence").map((c) => c.id));
    const byId = Object.fromEntries(coverage(CHALLENGES, solved).map((c) => [c.competency.id, c]));
    expect(byId[28]!.total).toBe(CHALLENGES.length);
    expect(byId[28]!.solved).toBe(solved.size);
    expect(byId[29]!.solved).toBe(0); // ningún reto de corregir o paradas resuelto
    expect(byId[20]!.total).toBe(challengesFor("ciencia", "inicial").length);
    expect(coverage(CHALLENGES, new Set()).every((c) => c.solved === 0)).toBe(true);
  });
});
