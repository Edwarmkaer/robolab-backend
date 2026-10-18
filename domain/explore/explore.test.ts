import { describe, expect, it } from "vitest";
import { EDUCATION_LEVELS, policyFor } from "../game/levels";
import { type Program, compile, countBlocks, move, repeat, usesOnly } from "../game/program";
import { simulate } from "../game/simulator";
import { shortestSolution } from "../game/solve";
import { CHALLENGES, type Challenge, TOPICS, type Topic, challengeById, challengesFor, nextChallenge } from "./challenges";
import { checkPrediction, checkProgram, finalCell } from "./check";
import { type ExploreProgress, catalogFor, emptyProgress, levelProgress, openChallenges, parseProgress, recordPlay, topicProgress } from "./progress";

const F = move("FORWARD");
const L = move("TURN_LEFT");
const R = move("TURN_RIGHT");

/** Retos de bloques por tópico: los de Inicial del Figma (Primaria se juega con misiones). */
const BLOCK_CHALLENGES: Record<Topic, number> = { ciencia: 6, tecnologia: 6, ingenieria: 5, artes: 5, matematicas: 6 };

/**
 * Los seis retos de bloques de Primaria (Tecnología) son legado: ya no se listan, pero siguen
 * resolviéndose (enlaces y partidas viejas). Su solución usa Repetir, que la búsqueda no arma.
 */
const LEGACY_SOLUTIONS: Record<string, Program | { row: number; col: number }> = {
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
  it("cada reto tiene id único, tres pistas, historia, habilidad y minutos", () => {
    expect(new Set(CHALLENGES.map((c) => c.id)).size).toBe(CHALLENGES.length);
    expect(new Set(CHALLENGES.map((c) => c.map.id)).size).toBe(CHALLENGES.length);
    for (const c of CHALLENGES) {
      expect(c.hints, c.id).toHaveLength(3);
      for (const hint of c.hints) expect(hint.trim().length, c.id).toBeGreaterThan(0);
      expect(c.story.trim().length, c.id).toBeGreaterThan(10);
      expect(c.skill.trim().length, c.id).toBeGreaterThan(0);
      expect(c.minutes, c.id).toMatch(/^\d+-\d+ min$/);
      expect(c.title.trim().length, c.id).toBeGreaterThan(0);
    }
  });

  it("todo reto se puede resolver con los bloques de su nivel (búsqueda en anchura sobre el mapa)", () => {
    for (const c of CHALLENGES) {
      const palette = policyFor(c.level).palette;
      if (c.kind === "predict") {
        // El programa dado nunca se sale del camino: la casilla final existe y se puede tocar.
        const run = simulate(c.map, compile(c.given));
        expect(run.outcome.kind, c.id).not.toBe("OFF_PATH");
        const answer = finalCell(c, c.given);
        expect(answer, c.id).not.toEqual(c.map.start);
        expect(checkPrediction(c, answer).ok, c.id).toBe(true);
        continue;
      }
      const solution = shortestSolution(c.map, palette);
      expect(solution, `${c.id} no tiene solución`).not.toBeNull();
      const legacy = LEGACY_SOLUTIONS[c.id];
      const program: Program = legacy ? (legacy as Program) : solution!.map(move);
      expect(usesOnly(program, palette), c.id).toBe(true);
      // Una solución cumple el reto: paradas, y el tope de bloques en los de eficiencia.
      expect(checkProgram(c, program).result, c.id).toMatchObject({ ok: true });
      if (c.kind === "efficient") expect(countBlocks(program), c.id).toBeLessThanOrEqual(c.maxBlocks);
    }
  });

  it("los retos de Primaria que quedan son el legado de Tecnología y su solución se conoce", () => {
    const legacy = CHALLENGES.filter((c) => c.level === "primaria");
    expect(legacy.map((c) => c.id).sort()).toEqual(Object.keys(LEGACY_SOLUTIONS).sort());
    expect(legacy.every((c) => c.topic === "tecnologia")).toBe(true);
    const where = byId("primaria-donde");
    expect(where.kind === "predict" && checkPrediction(where, LEGACY_SOLUTIONS["primaria-donde"] as { row: number; col: number }).ok).toBe(true);
    // No se listan: ni en el catálogo ni en el avance.
    expect(openChallenges().some((c) => c.level === "primaria")).toBe(false);
    expect(catalogFor("tecnologia", "primaria")).toEqual([]);
  });

  it("los programas dados solo usan bloques de su nivel, y el de corregir empieza con error", () => {
    for (const c of CHALLENGES) {
      if (c.kind === "predict" || c.kind === "fix") expect(usesOnly(c.given, policyFor(c.level).palette), c.id).toBe(true);
      if (c.kind === "fix") expect(checkProgram(c, c.given).result.ok, c.id).toBe(false);
    }
  });

  it("tiene las cantidades del Figma por tópico en Inicial (bloques) y ninguno listado de bloques en Primaria", () => {
    for (const t of TOPICS) {
      expect(t.available, t.id).toBe(true);
      expect(challengesFor(t.id, "inicial").length, t.id).toBe(BLOCK_CHALLENGES[t.id]);
      expect(catalogFor(t.id, "inicial").length, t.id).toBe(BLOCK_CHALLENGES[t.id]);
      expect(catalogFor(t.id, "secundaria"), t.id).toEqual([]);
    }
    expect(openChallenges()).toHaveLength(28);
    expect(CHALLENGES).toHaveLength(28 + Object.keys(LEGACY_SOLUTIONS).length);
  });

  it("cada tópico de Inicial mezcla tipos: al menos secuencia, paradas y corregir", () => {
    for (const t of TOPICS) {
      const kinds = new Set(challengesFor(t.id, "inicial").map((c) => c.kind));
      expect([...kinds], t.id).toEqual(expect.arrayContaining(["sequence", "stops", "fix"]));
    }
  });

  it("ordena por dificultad dentro de cada tópico y nivel, y sabe cuál sigue", () => {
    for (const t of TOPICS) {
      for (const level of EDUCATION_LEVELS) {
        const list = challengesFor(t.id, level);
        expect(list.map((c) => c.difficulty), `${t.id} ${level}`).toEqual([...list.map((c) => c.difficulty)].sort());
        if (list.length === 0) continue;
        expect(nextChallenge(list[0]!)?.id).toBe(list[1]!.id);
        expect(nextChallenge(list.at(-1)!)).toBeUndefined();
      }
    }
  });
});

describe("revisión de intentos", () => {
  it("dice en qué paso se salió del camino", () => {
    const fix = byId("inicial-ciencia-arregla");
    if (fix.kind !== "fix") throw new Error("inicial-ciencia-arregla debería ser de corregir");
    const { result } = checkProgram(fix, fix.given);
    expect(result).toMatchObject({ ok: false, reason: "OFF_PATH", step: 4 });
    expect(result.message).toMatch(/paso 4, al avanzar/);
  });

  it("no acepta llegar a la estrella sin pasar por todas las paradas", () => {
    // Atajo por el medio del laboratorio: llega a la estrella sin tocar ninguna muestra.
    const map = byId("inicial-ciencia-muestras");
    const shortcut: Program = [F, R, F, F, R, F];
    expect(checkProgram(map, shortcut).result).toMatchObject({ ok: false, reason: "MISSED_STOPS" });
    expect(checkProgram(map, shortcut).result.message).toMatch(/2 banderas/);
    // Por el taller, un atajo que toca solo un engranaje.
    const gears = byId("inicial-ingenieria-engranajes");
    const oneStop: Program = [F, R, F, F, L, F, F];
    expect(checkProgram(gears, oneStop).result).toMatchObject({ ok: false, reason: "MISSED_STOPS" });
    expect(checkProgram(gears, oneStop).result.message).toMatch(/una bandera/);
  });

  it("en eficiencia, llegar con demasiados bloques no basta", () => {
    const wobbly: Program = [F, F, F, R, L, R, F, F];
    expect(checkProgram(byId("inicial-matematicas-justos"), wobbly).result).toMatchObject({ ok: false, reason: "TOO_MANY_BLOCKS" });
    expect(checkProgram(byId("inicial-matematicas-justos"), [F, F, F, R, F, F]).result).toMatchObject({ ok: true });
  });

  it("rechaza bloques que el nivel no tiene", () => {
    expect(checkProgram(byId("inicial-paseo"), [repeat(3, [F])]).result).toMatchObject({ ok: false, reason: "BLOCKS" });
  });

  it("en predecir, compara con donde realmente termina", () => {
    const c = byId("inicial-ciencia-donde");
    expect(c.kind === "predict" && finalCell(c, c.given)).toEqual({ row: 1, col: 0 });
    expect(checkPrediction(c, { row: 1, col: 1 })).toMatchObject({ ok: false, reason: "WRONG_CELL" });
    expect(() => checkPrediction(byId("inicial-paseo"), { row: 0, col: 0 })).toThrow();
  });

  it("los giros al revés de la galería se detectan al bajar", () => {
    const art = byId("inicial-artes-arregla");
    if (art.kind !== "fix") throw new Error("inicial-artes-arregla debería ser de corregir");
    expect(checkProgram(art, art.given).result).toMatchObject({ ok: false, reason: "OFF_PATH", step: 5 });
    expect(checkProgram(art, [F, R, F, L, F, R, F]).result).toMatchObject({ ok: true });
  });
});

describe("avance guardado en el dispositivo", () => {
  const play = (p: ExploreProgress, id: string, solved: boolean, runs: number, hints = 0, ms = 60_000) =>
    recordPlay(p, id, { solved, runs, hints, ms }, 1000);

  it("guarda el mejor resultado: menos pistas, luego menos intentos y luego menos tiempo", () => {
    let p = play(emptyProgress(), "inicial-ciencia-probeta", false, 3);
    expect(p.records["inicial-ciencia-probeta"]).toMatchObject({ solved: false, plays: 1 });
    p = play(p, "inicial-ciencia-probeta", true, 4, 2);
    p = play(p, "inicial-ciencia-probeta", true, 6, 0);
    p = play(p, "inicial-ciencia-probeta", true, 2, 1);
    expect(p.records["inicial-ciencia-probeta"]).toMatchObject({ solved: true, plays: 4, best: { runs: 6, hints: 0 } });
  });

  it("resume cuántos retos resolvió por tópico y por nivel", () => {
    let p = play(emptyProgress(), "inicial-ciencia-probeta", true, 2);
    p = play(p, "inicial-ciencia-lupa", true, 1);
    p = play(p, "inicial-paseo", true, 1);
    p = play(p, "inicial-ciencia-derrame", false, 5);
    expect(topicProgress(p, "ciencia")).toEqual({ solved: 2, total: 6 });
    expect(topicProgress(p, "tecnologia")).toEqual({ solved: 1, total: 6 });
    expect(topicProgress(p, "artes")).toEqual({ solved: 0, total: 5 });
    expect(levelProgress(p, "ciencia", "inicial")).toEqual({ solved: 2, total: 6 });
    expect(levelProgress(p, "ciencia", "secundaria")).toEqual({ solved: 0, total: 0 });
  });

  it("un reto de bloques de Primaria jugado antes sigue guardado pero ya no cuenta en el avance", () => {
    const p = play(emptyProgress(), "primaria-casa", true, 2);
    expect(parseProgress(JSON.stringify(p)).records["primaria-casa"]).toMatchObject({ solved: true });
    expect(topicProgress(p, "tecnologia")).toEqual({ solved: 0, total: 6 });
  });

  it("lee con cuidado lo guardado: datos dañados o viejos empiezan de cero", () => {
    expect(parseProgress(null)).toEqual(emptyProgress());
    expect(parseProgress("{malo")).toEqual(emptyProgress());
    expect(parseProgress(JSON.stringify({ version: 99 }))).toEqual(emptyProgress());
    const saved = play(emptyProgress(), "inicial-ciencia-probeta", true, 2);
    expect(parseProgress(JSON.stringify(saved))).toEqual(saved);
    // Un reto que ya no existe se ignora.
    const withGhost = { ...saved, records: { ...saved.records, fantasma: saved.records["inicial-ciencia-probeta"] } };
    expect(parseProgress(JSON.stringify(withGhost)).records).not.toHaveProperty("fantasma");
  });
});
