import { describe, expect, it } from "vitest";
import { ACTIVE_LEVELS, EDUCATION_LEVELS } from "./levels";

describe("niveles que se ofrecen", () => {
  it("hoy son Inicial y Primaria, en ese orden", () => {
    expect(ACTIVE_LEVELS).toEqual(["inicial", "primaria"]);
  });

  it("son un subconjunto de los niveles que el dominio conoce (Secundaria sigue en el tipo por las clases anteriores)", () => {
    for (const level of ACTIVE_LEVELS) expect(EDUCATION_LEVELS).toContain(level);
    expect(EDUCATION_LEVELS).toContain("secundaria");
  });
});
