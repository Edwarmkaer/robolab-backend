/**
 * Búsqueda sobre estados (casilla + estaciones ya visitadas) con costo de
 * energía: Dijkstra. Encuentra la ruta más barata que visita las estaciones
 * que pide el nivel y termina en la meta, o dice que no existe dentro del
 * presupuesto. Es el validador: una misión sin solución no se publica.
 */
import {
  type Cell,
  DIRS,
  type Dir,
  LabDataError,
  type Mission,
  type MissionLevel,
  ROUGH_COST,
  STEP_COST,
  cellKey,
  cellSet,
  inBoard,
  moved,
  parseMission,
  sameCell,
  stationIndex,
} from "./mission";

export type Solution = { readonly path: readonly Dir[]; readonly cost: number };

/** Cuántas estaciones marca la máscara. */
export function countVisited(mask: number): number {
  let n = 0;
  for (let m = mask; m > 0; m >>= 1) n += m & 1;
  return n;
}

export const levelOf = (mission: Mission, level: number): MissionLevel => {
  const cfg = mission.levels[level];
  if (!cfg) throw new RangeError(`Nivel no válido: ${level}`);
  return cfg;
};

type Node = { readonly cell: Cell; readonly mask: number; readonly cost: number; readonly path: readonly Dir[] };

const stateKey = (cell: Cell, mask: number) => `${cellKey(cell)},${mask}`;

export function solve(mission: Mission, level: number): Solution | null {
  const cfg = levelOf(mission, level);
  const walls = cellSet(mission.walls);
  const rough = cellSet(mission.rough);
  const queue: Node[] = [{ cell: mission.start, mask: 0, cost: 0, path: [] }];
  const best = new Map<string, number>([[stateKey(mission.start, 0), 0]]);

  while (queue.length > 0) {
    // El más barato; a igual costo, el más antiguo (mismo orden que el prototipo).
    let cheapest = 0;
    for (let i = 1; i < queue.length; i++) if (queue[i]!.cost < queue[cheapest]!.cost) cheapest = i;
    const node = queue.splice(cheapest, 1)[0]!;
    if (sameCell(node.cell, mission.goal) && countVisited(node.mask) >= cfg.need) {
      return { path: node.path, cost: node.cost };
    }
    for (const dir of DIRS) {
      const next = moved(node.cell, dir);
      if (!inBoard(mission.size, next) || walls.has(cellKey(next))) continue;
      const station = stationIndex(mission, next);
      const mask = station >= 0 ? node.mask | (1 << station) : node.mask;
      const cost = node.cost + (rough.has(cellKey(next)) ? ROUGH_COST : STEP_COST);
      const key = stateKey(next, mask);
      if (cost > cfg.budget || cost >= (best.get(key) ?? Infinity)) continue;
      best.set(key, cost);
      queue.push({ cell: next, mask, cost, path: [...node.path, dir] });
    }
  }
  return null;
}

export type Validation =
  | { readonly ok: true; readonly mission: Mission; readonly solutions: readonly Solution[] }
  | { readonly ok: false; readonly message: string; readonly level: number | null };

export const NO_ROUTE_MESSAGE = "Uno o más niveles no tiene ruta dentro del presupuesto.";

/**
 * Revisa la forma de la misión y busca una ruta para cada nivel. Acepta datos
 * sin tipo para poder validar lo que llegue de cualquier fuente.
 */
export function validate(input: unknown): Validation {
  let mission: Mission;
  try {
    mission = parseMission(input);
  } catch (error) {
    if (error instanceof LabDataError) return { ok: false, message: error.message, level: null };
    throw error;
  }
  const solutions: Solution[] = [];
  for (const [i, level] of mission.levels.entries()) {
    const solution = solve(mission, i);
    if (!solution) {
      return {
        ok: false,
        level: i,
        message: `${NO_ROUTE_MESSAGE} Nivel ${i + 1} (${level.name}): ninguna ruta cumple con ${level.budget} de energía.`,
      };
    }
    solutions.push(solution);
  }
  return { ok: true, mission, solutions };
}
