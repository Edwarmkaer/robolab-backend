import { describe, expect, it } from "vitest";
import { policyFor } from "../game/levels";
import { type Program, move, repeat, usesOnly } from "../game/program";
import { CHALLENGES, type Challenge, challengeById, challengesFor, nextChallenge } from "./challenges";
import { checkPrediction, checkProgram, finalCell } from "./check";
import { missionsFor } from "../lab/mission";
import { type ExploreProgress, emptyProgress, openIds, parseProgress, recordPlay, topicProgress } from "./progress";

const F = move("FORWARD");
const L = move("TURN_LEFT");
const R = move("TURN_RIGHT");

/** Una solución correcta por reto (los de predecir llevan la casilla). */
const SOLUTIONS: Record<string, Program | { row: number; col: number }> = {
  "inicial-paseo": [F, F, F],
  "inicial-gira": [F, R, F, F, L, F],
  "inicial-charquito": [L, F, R, F, F, R, F],
  "inicial-donde": { row: 0, col: 1 },
  "inicial-arregla": [F, F, F, F],
  "primaria-casa": [F, F, R, F, F, L, F],
  "primaria-charco": [F, L, F, R, F, F, R, F],
  "primaria-donde": { row: 1, col: 2 },
  "primaria-arregla": [F, F, F, R, F, F, L, F],
  "primaria-paradas": [repeat(4, [F]), R, repeat(2, [F]), R, repeat(4, [F])],
  "primaria-menos": [repeat(2, [F, R, F, L]), F],
};

const byId = (id: string): Challenge => {
  const c = challengeById(id);
  if (!c) throw new Error(`Falta el reto ${id}`);
  return c;
};

describe("catálogo de retos", () => {
  it("cada reto tiene id único, tres pistas y una solución que funciona", () => {
    expect(new Set(CHALLENGES.map((c) => c.id)).size).toBe(CHALLENGES.length);
    for (const c of CHALLENGES) {
      expect(c.hints, c.id).toHaveLength(3);
      const solution = SOLUTIONS[c.id];
      expect(solution, `falta la solución de ${c.id}`).toBeDefined();
      if (c.kind === "predict") {
        expect(checkPrediction(c, solution as { row: number; col: number }).ok, c.id).toBe(true);
      } else {
        const program = solution as Program;
        expect(usesOnly(program, policyFor(c.level).palette), c.id).toBe(true);
        expect(checkProgram(c, program).result, c.id).toMatchObject({ ok: true });
      }
    }
  });

  it("los programas dados solo usan bloques de su nivel, y el de corregir empieza con error", () => {
    for (const c of CHALLENGES) {
      if (c.kind === "predict" || c.kind === "fix") expect(usesOnly(c.given, policyFor(c.level).palette), c.id).toBe(true);
      if (c.kind === "fix") expect(checkProgram(c, c.given).result.ok, c.id).toBe(false);
    }
  });

  it("ordena por nivel y sabe cuál sigue", () => {
    const primaria = challengesFor("tecnologia", "primaria");
    expect(primaria.map((c) => c.difficulty)).toEqual([...primaria.map((c) => c.difficulty)].sort());
    expect(nextChallenge(primaria[0]!)?.id).toBe(primaria[1]!.id);
    expect(nextChallenge(primaria.at(-1)!)).toBeUndefined();
    expect(challengesFor("ciencia", "inicial")).toEqual([]);
  });
});

describe("revisión de intentos", () => {
  it("Inicial puede corregir su recorrido retrocediendo sin usar bucles", () => {
    const program = [F, move("BACKWARD"), F, F, F];
    expect(checkProgram(byId("inicial-paseo"), program).result).toMatchObject({ ok: true });
    expect(checkProgram(byId("inicial-paseo"), [repeat(3, [F])]).result).toMatchObject({ ok: false, reason: "BLOCKS" });
  });

  it("dice en qué paso se salió del camino", () => {
    const fix = byId("primaria-arregla");
    if (fix.kind !== "fix") throw new Error("primaria-arregla debería ser de corregir");
    const { result } = checkProgram(fix, fix.given);
    expect(result).toMatchObject({ ok: false, reason: "OFF_PATH", step: 4 });
    expect(result.message).toMatch(/paso 4, al avanzar/);
  });

  it("no acepta llegar a la estrella sin pasar por todas las paradas", () => {
    // Llega por arriba y baja directo, sin volver por la segunda bandera.
    const map = byId("primaria-paradas");
    const shortcut: Program = [repeat(4, [F]), R, repeat(2, [F])];
    expect(checkProgram(map, shortcut).result).toMatchObject({ ok: false, reason: "INCOMPLETE" });
    const custom = { ...map, map: { ...map.map, stops: [...map.map.stops, { row: 9, col: 9 }] } };
    expect(checkProgram(custom, SOLUTIONS["primaria-paradas"] as Program).result).toMatchObject({
      ok: false,
      reason: "MISSED_STOPS",
    });
  });

  it("en eficiencia, llegar con demasiados bloques no basta", () => {
    const longWay: Program = [F, R, F, L, F, R, F, L, F];
    expect(checkProgram(byId("primaria-menos"), longWay).result).toMatchObject({ ok: false, reason: "TOO_MANY_BLOCKS" });
  });

  it("rechaza bloques que el nivel no tiene", () => {
    expect(checkProgram(byId("inicial-paseo"), [repeat(3, [F])]).result).toMatchObject({ ok: false, reason: "BLOCKS" });
  });

  it("en predecir, compara con donde realmente termina", () => {
    const c = byId("primaria-donde");
    expect(c.kind === "predict" && finalCell(c, c.given)).toEqual({ row: 1, col: 2 });
    expect(checkPrediction(c, { row: 1, col: 3 })).toMatchObject({ ok: false, reason: "WRONG_CELL" });
    expect(() => checkPrediction(byId("inicial-paseo"), { row: 0, col: 0 })).toThrow();
  });
});

describe("avance guardado en el dispositivo", () => {
  const play = (p: ExploreProgress, id: string, solved: boolean, runs: number, hints = 0, ms = 60_000) =>
    recordPlay(p, id, { solved, runs, hints, ms }, 1000);

  it("guarda el mejor resultado: menos pistas, luego menos intentos y luego menos tiempo", () => {
    let p = play(emptyProgress(), "primaria-casa", false, 3);
    expect(p.records["primaria-casa"]).toMatchObject({ solved: false, plays: 1 });
    p = play(p, "primaria-casa", true, 4, 2);
    p = play(p, "primaria-casa", true, 6, 0);
    p = play(p, "primaria-casa", true, 2, 1);
    expect(p.records["primaria-casa"]).toMatchObject({ solved: true, plays: 4, best: { runs: 6, hints: 0 } });
  });

  it("resume cuántos retos y misiones resolvió por tópico (los retos de bloques de Primaria ya no se listan)", () => {
    let p = play(emptyProgress(), "primaria-casa", true, 2);
    p = play(p, "inicial-paseo", true, 1);
    p = play(p, "primaria-charco", false, 5);
    p = play(p, "primaria-tecnologia-materiales", true, 3);
    const total = openIds("tecnologia").length;
    expect(total).toBe(CHALLENGES.filter((c) => c.topic === "tecnologia" && c.level === "inicial").length + missionsFor("tecnologia").length);
    expect(topicProgress(p, "tecnologia")).toEqual({ solved: 2, total });
    expect(topicProgress(p, "artes")).toEqual({ solved: 0, total: missionsFor("artes").length });
  });

  it("lee con cuidado lo guardado: datos dañados o viejos empiezan de cero", () => {
    expect(parseProgress(null)).toEqual(emptyProgress());
    expect(parseProgress("{malo")).toEqual(emptyProgress());
    expect(parseProgress(JSON.stringify({ version: 99 }))).toEqual(emptyProgress());
    const saved = play(emptyProgress(), "primaria-casa", true, 2);
    expect(parseProgress(JSON.stringify(saved))).toEqual(saved);
    // Un reto que ya no existe se ignora.
    const withGhost = { ...saved, records: { ...saved.records, fantasma: saved.records["primaria-casa"] } };
    expect(parseProgress(JSON.stringify(withGhost)).records).not.toHaveProperty("fantasma");
  });
});
