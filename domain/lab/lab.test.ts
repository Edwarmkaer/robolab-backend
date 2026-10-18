import { describe, expect, it } from "vitest";
import { TOPICS } from "../explore/challenges";
import { compile } from "../game/program";
import { simulate } from "../game/simulator";
import { toRobotText } from "../robot/protocol";
import { GENERIC_HINT, LAB_ERRORS, execute, hintFor, messageFor, nextHint, parseArrows } from "./execute";
import { THEMES, generateMission } from "./generate";
import { type Dir, MAX_ARROWS, MISSIONS, type Mission, missionById, missionsFor, parseMission } from "./mission";
import { LAB_START_HEADING, arrowsToProgram, headingAfter, missionToGameMap, toGameCell } from "./robot";
import { NO_ROUTE_MESSAGE, countVisited, solve, validate } from "./solve";

/** La misión del prototipo (tablero, estaciones y presupuestos del HTML). */
const RUTA = missionById("primaria-tecnologia-materiales")!;

const withLevels = (m: Mission, budgets: readonly [number, number, number]): Mission => ({
  ...m,
  levels: [
    { ...m.levels[0], budget: budgets[0] },
    { ...m.levels[1], budget: budgets[1] },
    { ...m.levels[2], budget: budgets[2] },
  ],
});

describe("misiones del modo abierto", () => {
  it("hay al menos una misión por tópico, con id único", () => {
    for (const topic of TOPICS) expect(missionsFor(topic.id).length, topic.id).toBeGreaterThan(0);
    expect(new Set(MISSIONS.map((m) => m.id)).size).toBe(MISSIONS.length);
    expect(missionById("no-existe")).toBeUndefined();
  });

  it.each(MISSIONS.map((m) => [m.id, m] as const))("%s pasa el validador y sus tres niveles tienen ruta", (_id, m) => {
    const check = validate(m);
    expect(check.ok, check.ok ? "" : check.message).toBe(true);
    if (!check.ok) return;
    // El presupuesto deja margen en 2.º y 3.º y aprieta en 4.º; la ruta mínima siempre cabe.
    check.solutions.forEach((s, i) => expect(s.cost, `nivel ${i + 1}`).toBeLessThanOrEqual(m.levels[i]!.budget));
    expect(m.levels[2]!.budget).toBeLessThan(m.levels[1]!.budget);
    expect(m.levels[0]!.need).toBe(1);
    expect(m.levels[1]!.need).toBe(2);
  });

  it("la misión del prototipo conserva su tablero y sus presupuestos (30, 33, 27)", () => {
    expect(RUTA.walls).toHaveLength(6);
    expect(RUTA.rough).toHaveLength(5);
    expect(RUTA.stations).toEqual([[0, 5], [5, 0]]);
    expect(RUTA.levels.map((l) => l.budget)).toEqual([30, 33, 27]);
    expect(RUTA.levels.map((l) => l.need)).toEqual([1, 2, 2]);
  });
});

describe("solve: búsqueda sobre estados con energía", () => {
  it("encuentra la ruta más barata y esa ruta se ejecuta bien", () => {
    for (const level of [0, 1, 2]) {
      const solution = solve(RUTA, level)!;
      expect(solution).not.toBeNull();
      const run = execute(RUTA, level, solution.path);
      expect(run.ok, `nivel ${level}`).toBe(true);
      expect(run.cost).toBe(solution.cost);
    }
  });

  it("visitar las dos estaciones cuesta más que visitar una", () => {
    expect(solve(RUTA, 1)!.cost).toBeGreaterThan(solve(RUTA, 0)!.cost);
    expect(solve(RUTA, 1)!.cost).toBe(solve(RUTA, 2)!.cost); // mismo objetivo, menos presupuesto
  });

  it("devuelve null cuando no hay ruta dentro del presupuesto", () => {
    expect(solve(withLevels(RUTA, [5, 5, 5]), 0)).toBeNull();
    expect(() => solve(RUTA, 3)).toThrowError(RangeError);
  });

  it("cuenta las estaciones de la máscara", () => {
    expect([0, 1, 2, 3, 0b1011].map(countVisited)).toEqual([0, 1, 1, 2, 3]);
  });
});

describe("validate: una misión sin solución no se publica", () => {
  it("rechaza presupuestos que no alcanzan y dice en qué nivel", () => {
    const check = validate(withLevels(RUTA, [30, 33, 10]));
    expect(check.ok).toBe(false);
    if (check.ok) return;
    expect(check.level).toBe(2);
    expect(check.message).toContain(NO_ROUTE_MESSAGE);
    expect(check.message).toContain("4.º primaria");
  });

  it("rechaza una meta encerrada entre paredes", () => {
    const boxed: Mission = { ...RUTA, walls: [...RUTA.walls, [4, 5], [5, 4]] };
    expect(validate(boxed)).toMatchObject({ ok: false, level: 0 });
  });

  it.each([
    [{ ...RUTA, size: 5 }, /6 × 6/],
    [{ ...RUTA, walls: [...RUTA.walls, [0, 0]] }, /tapa el inicio/],
    [{ ...RUTA, stations: [[0, 5], [0, 5]] }, /repetidas/],
    [{ ...RUTA, levels: RUTA.levels.slice(0, 2) }, /3 niveles/],
    [{ ...RUTA, levels: [RUTA.levels[0], RUTA.levels[1], { ...RUTA.levels[2], need: 3 }] }, /entre 0 y 2/],
    [{ ...RUTA, start: [6, 0] }, /fuera del tablero/],
    [{ ...RUTA, id: "Con Espacios" }, /minúsculas/],
    [{ ...RUTA, topic: "historia" }, /Tópico/],
    [{ ...RUTA, hints: ["una"] }, /3 pistas/],
    ["texto", /formato/],
  ])("rechaza datos mal formados %#", (input, message) => {
    expect(() => parseMission(input)).toThrowError(message);
    expect(validate(input)).toMatchObject({ ok: false, level: null });
  });

  it("acepta la misión tal como se guarda y la devuelve igual", () => {
    expect(parseMission(JSON.parse(JSON.stringify(RUTA)))).toEqual(RUTA);
  });
});

describe("execute: los mismos errores y mensajes que el prototipo", () => {
  const R = "R" as const;

  it("Fuera del tablero", () => {
    const run = execute(RUTA, 0, ["U"]);
    expect(run).toMatchObject({ ok: false, error: "Fuera del tablero", failedStep: 1, cost: 0 });
    expect(run.steps).toHaveLength(1);
  });

  it("El robot chocó con una pared (y se queda en la última casilla válida)", () => {
    const run = execute(RUTA, 0, ["D", "R"]); // (1,0) → (1,1) es pared
    expect(run).toMatchObject({ ok: false, error: "El robot chocó con una pared", failedStep: 2, cost: 1 });
    expect(run.steps.at(-1)!.cell).toEqual([1, 0]);
  });

  it("Presupuesto de energía superado, contando el terreno difícil a 3", () => {
    const tight = withLevels(RUTA, [3, 3, 3]);
    const run = execute(tight, 0, [R, R]); // (0,1) cuesta 1, (0,2) es terreno difícil: 1 + 3 = 4 > 3
    expect(run).toMatchObject({ ok: false, error: "Presupuesto de energía superado", failedStep: 2, cost: 4 });
  });

  it("No llegó a la meta", () => {
    expect(execute(RUTA, 0, []).error).toBe("No llegó a la meta");
    expect(execute(RUTA, 0, [R]).error).toBe("No llegó a la meta");
  });

  it("Faltan estaciones obligatorias", () => {
    // Directo a la meta por el borde inferior sin pasar por B (5,0): abajo hasta (4,0), derecha y abajo.
    const path: Dir[] = ["D", "D", "D", "D", "R", "D", "R", "R", "R", "R"];
    const run = execute(RUTA, 0, path);
    expect(run.steps.at(-1)!.cell).toEqual([5, 5]);
    expect(run).toMatchObject({ ok: false, error: "Faltan estaciones obligatorias", stations: 0 });
  });

  it("completa la misión con la solución verificada y marca las estaciones", () => {
    const run = execute(RUTA, 1, solve(RUTA, 1)!.path);
    expect(run).toMatchObject({ ok: true, error: null, stations: 2, failedStep: null });
    expect(run.steps[0]).toEqual({ cell: [0, 0], cost: 0, mask: 0, dir: null });
    expect(messageFor(run)).toMatch(/¡Misión completada!/);
    expect(messageFor({ ok: false, error: "No llegó a la meta" })).toBe("Todavía no: No llegó a la meta. Revisa tu secuencia.");
  });

  it("cada error tiene su pista; sin error, la general", () => {
    for (const error of LAB_ERRORS) expect(hintFor(error)).toMatch(/^Pista: /);
    expect(hintFor("El robot chocó con una pared")).toContain("pared");
    expect(hintFor("Presupuesto de energía superado")).toContain("tres veces");
    expect(hintFor("Faltan estaciones obligatorias")).toContain("estaciones");
    expect(hintFor("No llegó a la meta")).toContain("último tramo");
    expect(hintFor(null)).toBe(GENERIC_HINT);
    expect(hintFor("Fuera del tablero")).toBe(GENERIC_HINT);
  });

  it("las pistas de la misión van de lo general a lo concreto hasta que hay un error que explicar", () => {
    expect(nextHint(RUTA, 0, null)).toBe(RUTA.hints[0]);
    expect(nextHint(RUTA, 5, null)).toBe(RUTA.hints[2]);
    expect(nextHint(RUTA, 0, "No llegó a la meta")).toBe(hintFor("No llegó a la meta"));
  });

  it("parseArrows acepta solo U/D/L/R y hasta 80 flechas", () => {
    expect(parseArrows(["U", "D", "L", "R"])).toEqual(["U", "D", "L", "R"]);
    expect(() => parseArrows(["X"])).toThrowError(/Flecha desconocida/);
    expect(() => parseArrows("RRDD")).toThrowError(/lista/);
    expect(() => parseArrows(Array(MAX_ARROWS + 1).fill("R"))).toThrowError(/80 instrucciones/);
  });
});

describe("del laboratorio al robot: flechas absolutas → bloques relativos", () => {
  it("gira lo justo antes de cada avance (empieza mirando a la derecha)", () => {
    expect(toRobotText(arrowsToProgram(["R", "R", "D", "L"]))).toBe("AAZAZA");
    expect(toRobotText(arrowsToProgram(["U"]))).toBe("DA");
    expect(toRobotText(arrowsToProgram(["L"]))).toBe("ZZA");
    expect(toRobotText(arrowsToProgram(["D", "U"], 180))).toBe("AZZA");
    expect(arrowsToProgram([])).toEqual([]);
    expect(headingAfter([])).toBe(LAB_START_HEADING);
    expect(headingAfter(["R", "U"])).toBe(0);
  });

  it("la ruta verificada recorre las mismas casillas en el simulador de bloques y llega a la meta", () => {
    for (const mission of MISSIONS) {
      const path = solve(mission, 1)!.path;
      const map = missionToGameMap(mission);
      const run = simulate(map, compile(arrowsToProgram(path)));
      expect(run.outcome.kind, mission.id).toBe("GOAL");
      const visited = run.steps.filter((s) => s.command === "FORWARD").map((s) => s.state.cell);
      expect(visited, mission.id).toEqual(execute(mission, 1, path).steps.slice(1).map((s) => toGameCell(s.cell)));
    }
  });

  it("el mapa equivalente conserva inicio, meta y estaciones como paradas", () => {
    const map = missionToGameMap(RUTA);
    expect(map.start).toEqual({ row: 0, col: 0 });
    expect(map.goal).toEqual({ row: 5, col: 5 });
    expect(map.stops).toEqual(RUTA.stations.map(toGameCell));
    expect(map.walkable.size).toBe(36 - RUTA.walls.length);
  });
});

describe("generador del docente", () => {
  it("toda variante de todo contexto pasa el validador", () => {
    for (const theme of THEMES) {
      for (let seed = 0; seed < 8; seed++) {
        const check = validate(generateMission(theme, seed));
        expect(check.ok, `${theme} semilla ${seed}: ${check.ok ? "" : check.message}`).toBe(true);
      }
    }
  });

  it("es determinista y 'otra variante' cambia el orden de las estaciones o el tablero", () => {
    expect(generateMission("escuela", 1)).toEqual(generateMission("escuela", 1));
    const [a, b] = [generateMission("escuela", 0), generateMission("escuela", 1)];
    expect(a.stations).toEqual([...b.stations].reverse());
    expect(generateMission("escuela", 2).walls).not.toEqual(a.walls);
    expect(generateMission("escuela", 0).title).toBe("Ruta de materiales");
    expect(generateMission("biblioteca", 0).topic).toBe("matematicas");
    expect(generateMission("comunidad", -3).id).toBe("docente-comunidad-0");
  });

  it("la primera variante de 'escuela' es el tablero del prototipo", () => {
    const m = generateMission("escuela", 0);
    expect(m.walls).toEqual(RUTA.walls);
    expect(m.levels.map((l) => l.budget)).toEqual([30, 33, 27]);
  });
});
