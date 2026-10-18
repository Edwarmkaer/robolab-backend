/**
 * Ejecuta el programa de flechas del alumno sobre la misión y dice qué pasó:
 * por dónde pasó el robot, cuánta energía gastó, qué estaciones tocó y, si
 * falló, por qué. Lo usan la animación del navegador y el servidor, que lo
 * vuelve a correr antes de anotar el intento.
 */
import {
  type Cell,
  DIRS,
  type Dir,
  LabDataError,
  MAX_ARROWS,
  type Mission,
  ROUGH_COST,
  STEP_COST,
  cellKey,
  cellSet,
  inBoard,
  moved,
  sameCell,
  stationIndex,
} from "./mission";
import { countVisited, levelOf } from "./solve";

/** Los errores, con el texto exacto que ve el alumno. */
export const LAB_ERRORS = [
  "Fuera del tablero",
  "El robot chocó con una pared",
  "Presupuesto de energía superado",
  "No llegó a la meta",
  "Faltan estaciones obligatorias",
] as const;
export type LabError = (typeof LAB_ERRORS)[number];
export const isLabError = (value: unknown): value is LabError =>
  typeof value === "string" && (LAB_ERRORS as readonly string[]).includes(value);

export type LabStep = {
  readonly cell: Cell;
  readonly cost: number;
  readonly mask: number;
  /** Flecha que trajo al robot hasta aquí; null en la posición inicial. */
  readonly dir: Dir | null;
};

export type Execution = {
  readonly ok: boolean;
  readonly error: LabError | null;
  readonly cost: number;
  readonly mask: number;
  readonly stations: number;
  /** Empieza con la posición inicial; cada flecha válida agrega un paso. */
  readonly steps: readonly LabStep[];
  /** Flecha (1-based) que provocó el error, si el error fue en el camino. */
  readonly failedStep: number | null;
};

export function execute(mission: Mission, level: number, arrows: readonly Dir[]): Execution {
  const cfg = levelOf(mission, level);
  const walls = cellSet(mission.walls);
  const rough = cellSet(mission.rough);
  let cell = mission.start;
  let cost = 0;
  let mask = 0;
  let error: LabError | null = null;
  let failedStep: number | null = null;
  const steps: LabStep[] = [{ cell, cost, mask, dir: null }];

  for (const [i, dir] of arrows.entries()) {
    const next = moved(cell, dir);
    if (!inBoard(mission.size, next)) {
      error = "Fuera del tablero";
      failedStep = i + 1;
      break;
    }
    if (walls.has(cellKey(next))) {
      error = "El robot chocó con una pared";
      failedStep = i + 1;
      break;
    }
    cell = next;
    cost += rough.has(cellKey(cell)) ? ROUGH_COST : STEP_COST;
    const station = stationIndex(mission, cell);
    if (station >= 0) mask |= 1 << station;
    steps.push({ cell, cost, mask, dir });
    if (cost > cfg.budget) {
      error = "Presupuesto de energía superado";
      failedStep = i + 1;
      break;
    }
  }
  if (!error) {
    if (!sameCell(cell, mission.goal)) error = "No llegó a la meta";
    else if (countVisited(mask) < cfg.need) error = "Faltan estaciones obligatorias";
  }
  return { ok: error === null, error, cost, mask, stations: countVisited(mask), steps, failedStep };
}

export const SUCCESS_MESSAGE = "¡Misión completada! Ruta válida y dentro del presupuesto. Puedes enviarla al robot.";

/** Lo que se le dice al alumno después de ejecutar. */
export const messageFor = (result: Pick<Execution, "ok" | "error">): string =>
  result.ok ? SUCCESS_MESSAGE : `Todavía no: ${result.error}. Revisa tu secuencia.`;

const HINTS: Record<LabError, string> = {
  "El robot chocó con una pared": "Pista: mira qué casilla es una pared e intenta rodearla.",
  "Presupuesto de energía superado": "Pista: las casillas amarillas cuestan tres veces más. Busca otro camino.",
  "Faltan estaciones obligatorias": "Pista: debes tocar las estaciones marcadas antes de la meta.",
  "No llegó a la meta": "Pista: todavía no llegas al destino. Comprueba el último tramo.",
  "Fuera del tablero": "Pista: prueba una ruta que visite las estaciones y evite terrenos costosos.",
};
export const GENERIC_HINT = HINTS["Fuera del tablero"];

/** Pista según el error del último intento (o la general si no hay error). */
export const hintFor = (error: LabError | null): string => (error ? HINTS[error] : GENERIC_HINT);

/**
 * Qué pista dar: si el último intento falló, la que explica ese error; si no
 * (todavía no ejecutó), las tres pistas de la misión, de la más general a la
 * más concreta.
 */
export const nextHint = (mission: Mission, hintsUsed: number, lastError: LabError | null): string =>
  lastError ? hintFor(lastError) : mission.hints[Math.min(Math.max(hintsUsed, 0), mission.hints.length - 1)]!;

const isDir = (value: unknown): value is Dir => typeof value === "string" && (DIRS as readonly string[]).includes(value);

/** Valida un programa de flechas tal como llega del navegador. */
export function parseArrows(input: unknown): Dir[] {
  if (!Array.isArray(input)) throw new LabDataError("El programa debe ser una lista de flechas.");
  if (input.length > MAX_ARROWS) throw new LabDataError(`Límite de ${MAX_ARROWS} instrucciones por programa.`);
  return input.map((item) => {
    if (!isDir(item)) throw new LabDataError("Flecha desconocida.");
    return item;
  });
}
