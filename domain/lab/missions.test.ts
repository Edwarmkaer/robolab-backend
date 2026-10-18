import { describe, expect, it } from "vitest";
import { CHALLENGES, TOPICS, type Topic } from "../explore/challenges";
import { execute } from "./execute";
import { type Dir, MISSIONS, type Mission, levelsFor, missionById, missionsFor, sameCell } from "./mission";
import { MISSION_ORDER, MORE_MISSIONS } from "./missions";
import { solve, validate } from "./solve";

/** Misiones de Primaria por tópico: junto con los retos de Inicial dan las cantidades de "Mi avance" del Figma (M8). */
const PER_TOPIC: Record<Topic, number> = { ciencia: 6, tecnologia: 6, ingenieria: 5, artes: 4, matematicas: 5 };

/** La misma misión sin estaciones obligatorias: lo que costaría ir directo a la meta. */
const withoutStations = (m: Mission): Mission => ({ ...m, levels: m.levels.map((l) => ({ ...l, need: 0 })) as unknown as Mission["levels"] });

const mission = (id: string): Mission => {
  const m = missionById(id);
  if (!m) throw new Error(`Falta la misión ${id}`);
  return m;
};

const WORD_TO_DIR: Record<string, Dir> = { sube: "U", baja: "D", "ve a la izquierda": "L", "ve a la derecha": "R" };

/** Las flechas que describe la tercera pista ("Una ruta posible: sube 1, ve a la derecha 2…"). */
function routeFromHint(hint: string): Dir[] {
  const match = /^Una ruta posible: (.+)\.$/.exec(hint);
  if (!match) throw new Error(`La pista no describe una ruta: ${hint}`);
  return match[1]!.split(", ").flatMap((part) => {
    const parsed = /^(sube|baja|ve a la izquierda|ve a la derecha) (\d+)$/.exec(part);
    if (!parsed) throw new Error(`Tramo no válido: ${part}`);
    return Array<Dir>(Number(parsed[2])).fill(WORD_TO_DIR[parsed[1]!]!);
  });
}

describe("misiones de Primaria: cantidades y orden", () => {
  it("hay 26 misiones con id único, y su orden de lista es el declarado", () => {
    expect(MISSIONS).toHaveLength(26);
    expect(new Set(MISSIONS.map((m) => m.id)).size).toBe(26);
    expect(MISSIONS.map((m) => m.id)).toEqual(MISSION_ORDER);
    expect(MORE_MISSIONS).toHaveLength(21);
  });

  it("cada tópico tiene las misiones del Figma y los ids dicen su tópico", () => {
    for (const t of TOPICS) {
      const list = missionsFor(t.id);
      expect(list.length, t.id).toBe(PER_TOPIC[t.id]);
      for (const m of list) {
        expect(m.id.startsWith(`primaria-${t.id}-`), m.id).toBe(true);
        expect(m.level).toBe("primaria");
      }
    }
  });

  it("dentro de cada tópico van de más fácil a más difícil (energía mínima con las dos estaciones)", () => {
    for (const t of TOPICS) {
      const costs = missionsFor(t.id).map((m) => solve(m, 1)!.cost);
      expect(costs, t.id).toEqual([...costs].sort((a, b) => a - b));
    }
  });
});

describe("misiones de Primaria: cada una se puede resolver", () => {
  it.each(MISSIONS.map((m) => [m.id, m] as const))("%s pasa el validador y sus tres subniveles tienen ruta", (_id, m) => {
    const check = validate(m);
    expect(check.ok, check.ok ? "" : check.message).toBe(true);
    if (!check.ok) return;
    expect(check.solutions).toHaveLength(3);
    // Los textos caben en lo que acepta parseMission (título, consigna y pistas) y hay emoji.
    expect(m.hints).toHaveLength(3);
    expect(m.emoji.length).toBeGreaterThan(0);
    expect(m.story.length).toBeGreaterThan(30);
    expect(m.stations).toHaveLength(2);
  });

  it.each(MISSIONS.map((m) => [m.id, m] as const))("%s: el presupuesto pasa de holgado a ajustado", (_id, m) => {
    const slack = m.levels.map((l, i) => l.budget - solve(m, i)!.cost);
    expect(slack[0], "2.º").toBeGreaterThan(slack[1]!);
    expect(slack[1], "3.º").toBeGreaterThan(slack[2]!);
    expect(slack[2], "4.º").toBeGreaterThanOrEqual(0);
    expect(slack[2], "4.º queda ajustado").toBeLessThanOrEqual(5);
    expect(m.levels.map((l) => l.need)).toEqual([1, 2, 2]);
  });

  it.each(MORE_MISSIONS.map((m) => [m.id, m] as const))("%s: las estaciones obligan a desviarse y el 4.º nivel no deja pasarse", (_id, m) => {
    const direct = solve(withoutStations(m), 0)!.cost;
    const one = solve(m, 0)!.cost;
    const both = solve(m, 1)!.cost;
    expect(one, "una estación no cuesta menos que ir directo").toBeGreaterThanOrEqual(direct);
    expect(both, "las dos estaciones cuestan más que ir directo y más que una sola").toBeGreaterThan(Math.max(direct, one));
    // Con un punto menos de energía que la ruta mínima, el 4.º nivel no tiene solución.
    const tooTight: Mission = { ...m, levels: [m.levels[0], m.levels[1], { ...m.levels[2], budget: both - 1 }] };
    expect(solve(tooTight, 2)).toBeNull();
  });

  it("la ruta mínima de cada nivel no pasa por la meta antes de terminar (el simulador de bloques se detendría ahí)", () => {
    for (const m of MISSIONS) {
      for (const level of [0, 1, 2]) {
        const route = solve(m, level)!.path;
        const cells = execute(m, level, route).steps.map((s) => s.cell);
        const early = cells.slice(0, -1).some((cell) => sameCell(cell, m.goal));
        expect(early, `${m.id} nivel ${level + 1}`).toBe(false);
      }
    }
  });

  it("los subniveles se llaman y se describen igual que en el resto del laboratorio", () => {
    for (const m of MISSIONS) {
      const expected = levelsFor([1, 1, 1]);
      expect(m.levels.map(({ name, need, description }) => ({ name, need, description })), m.id).toEqual(
        expected.map(({ name, need, description }) => ({ name, need, description })),
      );
    }
  });
});

describe("misiones de Primaria: contenido propio de cada una", () => {
  it("los tableros nuevos son todos distintos entre sí y de los del prototipo", () => {
    const board = (m: Mission) => JSON.stringify([m.walls, m.rough, m.stations, m.start, m.goal]);
    const core = MISSIONS.filter((m) => !MORE_MISSIONS.includes(m));
    expect(core).toHaveLength(5);
    // Las del prototipo repiten tablero a propósito (huerto y mural, obra y biblioteca): se comparan solo las nuevas.
    const fresh = MORE_MISSIONS.map(board);
    expect(new Set(fresh).size).toBe(fresh.length);
    const coreShapes = new Set(core.map((m) => JSON.stringify([m.walls, m.rough])));
    for (const m of MORE_MISSIONS) expect(coreShapes.has(JSON.stringify([m.walls, m.rough])), m.id).toBe(false);
  });

  it("cada tablero nuevo tiene obstáculos de verdad: paredes y terreno difícil", () => {
    for (const m of MORE_MISSIONS) {
      expect(m.walls.length, m.id).toBeGreaterThanOrEqual(4);
      expect(m.rough.length, m.id).toBeGreaterThanOrEqual(1);
    }
  });

  it("la tercera pista de cada misión nueva describe una ruta que de verdad cumple el 4.º nivel", () => {
    for (const m of MORE_MISSIONS) {
      const run = execute(m, 2, routeFromHint(m.hints[2]));
      expect(run.ok, `${m.id}: ${run.error}`).toBe(true);
      expect(run.stations, m.id).toBe(2);
    }
  });

  it("las pistas van de lo general a lo concreto y la tercera es la más larga", () => {
    for (const m of MORE_MISSIONS) {
      expect(m.hints[0].length, m.id).toBeLessThan(m.hints[2].length);
      expect(new Set(m.hints).size, m.id).toBe(3);
    }
  });

  it("ningún título se repite, ni con el de un reto de bloques del mismo tópico (los de Primaria que ya no se listan tampoco)", () => {
    expect(new Set(MISSIONS.map((m) => m.title)).size).toBe(MISSIONS.length);
    for (const m of MISSIONS) {
      const clash = CHALLENGES.find((c) => c.topic === m.topic && c.title === m.title);
      expect(clash?.id, m.id).toBeUndefined();
    }
  });

  it("cada misión cuenta una historia de su tópico y nombra las dos estaciones", () => {
    for (const m of MORE_MISSIONS) {
      expect(m.story, m.id).toMatch(/\bA\b/);
      expect(m.story, m.id).toMatch(/\bB\b/);
    }
    expect(mission("primaria-tecnologia-charco").story).toMatch(/charco/);
    expect(mission("primaria-ingenieria-puente").story).toMatch(/puente/);
    expect(mission("primaria-ciencia-hormigas").title).toBe("Camino de las hormigas");
  });
});
