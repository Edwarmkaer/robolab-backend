import { describe, expect, it } from "vitest";
import { feedbackFor } from "./feedback";
import { EDUCATION_LEVELS, policyFor } from "./levels";
import { type GameMap, MapError, cellKey, parseMap } from "./map";
import { type Command, COMMANDS } from "./program";
import { simulate } from "./simulator";

const straight = parseMap("recta", ["S..G"], 90);
const corner = parseMap("esquina", ["S.#", "#.#", "#.G"], 90);

describe("simulate", () => {
  it("llega a la meta y deja de ejecutar en ese paso", () => {
    const run = simulate(straight, ["FORWARD", "FORWARD", "FORWARD", "FORWARD"]);
    expect(run.outcome).toEqual({ kind: "GOAL", stepsUsed: 3 });
    expect(run.steps).toHaveLength(3);
    expect(run.steps.at(-1)?.state.cell).toEqual({ row: 0, col: 3 });
  });

  it("gira sin moverse y respeta la orientación", () => {
    const run = simulate(corner, ["FORWARD", "TURN_RIGHT", "FORWARD", "FORWARD", "TURN_LEFT", "FORWARD"]);
    expect(run.outcome.kind).toBe("GOAL");
    expect(run.steps[1]?.state).toEqual({ cell: { row: 0, col: 1 }, heading: 180 });
  });

  it("informa el paso exacto en que el robot sale del camino", () => {
    const run = simulate(corner, ["FORWARD", "FORWARD"]);
    expect(run.outcome).toEqual({
      kind: "OFF_PATH",
      failedStep: 2,
      command: "FORWARD",
      attempted: { row: 0, col: 2 },
    });
    expect(run.steps).toHaveLength(1);
  });

  it("detecta salidas por el borde del mapa", () => {
    const run = simulate(straight, ["BACKWARD"]);
    expect(run.outcome).toMatchObject({ kind: "OFF_PATH", attempted: { row: 0, col: -1 } });
  });

  it("distingue un programa vacío de uno incompleto", () => {
    expect(simulate(straight, []).outcome).toEqual({ kind: "EMPTY" });
    expect(simulate(straight, ["FORWARD"]).outcome).toEqual({ kind: "INCOMPLETE", stepsUsed: 1 });
  });

  it("cuatro giros a la izquierda vuelven a la orientación inicial", () => {
    const run = simulate(straight, ["TURN_LEFT", "TURN_LEFT", "TURN_LEFT", "TURN_LEFT"]);
    expect(run.steps.at(-1)?.state.heading).toBe(90);
  });
});

describe("feedbackFor", () => {
  it("señala el bloque del error para que el alumno lo revise", () => {
    const fb = feedbackFor(simulate(corner, ["FORWARD", "FORWARD"]).outcome);
    expect(fb).toMatchObject({ tone: "retry", highlightStep: 2 });
    expect(fb.detail).toContain("paso 2");
  });

  it("felicita al llegar a la meta", () => {
    expect(feedbackFor({ kind: "GOAL", stepsUsed: 3 }).tone).toBe("success");
  });
});

describe("parseMap", () => {
  it.each([
    [["S..", "..G", "S.."], /más de un inicio/],
    [["S..", "...", "..."], /falta la meta/],
    [["S..", "..", "..G"], /columnas/],
    [["S.x", "..G"], /no válido/],
  ])("rechaza mapas mal escritos %#", (layout, error) => {
    expect(() => parseMap("malo", layout, 90)).toThrowError(MapError);
    expect(() => parseMap("malo", layout, 90)).toThrowError(error);
  });

  it("el agua no se pisa y las paradas sí, y quedan anotadas", () => {
    const map = parseMap("charco", ["S.P", ".WG"], 90);
    expect(map.stops).toEqual([{ row: 0, col: 2 }]);
    expect(simulate(map, ["TURN_RIGHT", "FORWARD", "TURN_LEFT", "FORWARD"]).outcome).toMatchObject({
      kind: "OFF_PATH",
      failedStep: 4,
    });
    expect(simulate(map, ["FORWARD", "FORWARD", "TURN_RIGHT", "FORWARD"]).outcome.kind).toBe("GOAL");
  });

  it("un mapa sin meta solo se acepta si se pide; el robot nunca termina antes", () => {
    expect(() => parseMap("libre", ["S..", "..."], 90)).toThrowError(/falta la meta/);
    const free = parseMap("libre", ["S..", "..."], 90, { goalOptional: true });
    expect(free.goal).toBeNull();
    const run = simulate(free, ["FORWARD", "FORWARD", "TURN_RIGHT", "FORWARD"]);
    expect(run.outcome.kind).toBe("INCOMPLETE");
    expect(run.steps.at(-1)?.state.cell).toEqual({ row: 1, col: 2 });
  });
});

/** Búsqueda en anchura sobre (celda, orientación): el camino más corto. */
function shortestSolution(map: GameMap, palette: ReadonlySet<string>): Command[] | null {
  const commands = COMMANDS.filter((c) => palette.has(c));
  const startKey = `${cellKey(map.start)}@${map.startHeading}`;
  const queue: { key: string; path: Command[] }[] = [{ key: startKey, path: [] }];
  const seen = new Set([startKey]);
  while (queue.length > 0) {
    const { path } = queue.shift()!;
    for (const command of commands) {
      const candidate = [...path, command];
      const run = simulate(map, candidate);
      if (run.outcome.kind === "GOAL") return candidate;
      if (run.outcome.kind !== "INCOMPLETE") continue;
      const last = run.steps.at(-1)!.state;
      const key = `${cellKey(last.cell)}@${last.heading}`;
      if (!seen.has(key)) {
        seen.add(key);
        queue.push({ key, path: candidate });
      }
    }
  }
  return null;
}

describe("bancos de mapas por nivel", () => {
  it.each(EDUCATION_LEVELS)("todos los mapas de %s se pueden resolver con su paleta", (level) => {
    const policy = policyFor(level);
    for (const map of policy.maps) {
      expect(shortestSolution(map, policy.palette), map.id).not.toBeNull();
    }
  });

  it("la dificultad de Inicial crece mapa a mapa", () => {
    const policy = policyFor("inicial");
    const lengths = policy.maps.map((m) => shortestSolution(m, policy.palette)!.length);
    expect(lengths).toEqual([...lengths].sort((a, b) => a - b));
  });

  it("asigna un mapa a cada etapa y rota si hay más preguntas que mapas", () => {
    const policy = policyFor("inicial");
    expect(policy.mapFor(0).id).toBe("inicial-1");
    expect(policy.mapFor(policy.maps.length).id).toBe("inicial-1");
    expect(() => policy.mapFor(-1)).toThrowError(RangeError);
  });

  it("Inicial no ofrece bucles", () => {
    const palette = policyFor("inicial").palette;
    expect(palette.has("repeat")).toBe(false);
  });
});
