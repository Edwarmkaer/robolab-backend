/**
 * Política por nivel educativo (patrón Strategy).
 *
 * Cada nivel define qué bloques ve el alumno y de qué banco salen los mapas.
 * Agregar Primaria o Secundaria es agregar una política, sin tocar el
 * simulador ni la evaluación.
 */
import { type GameMap, parseMap } from "./map";
import type { Block, Command } from "./program";

export type EducationLevel = "inicial" | "primaria" | "secundaria";

export const EDUCATION_LEVELS: readonly EducationLevel[] = ["inicial", "primaria", "secundaria"];

/**
 * Los niveles que hoy se ofrecen en la web. Secundaria sigue en `EducationLevel`
 * porque pudo haber clases creadas con ese nivel; la web ya no lo ofrece.
 */
export const ACTIVE_LEVELS: readonly EducationLevel[] = ["inicial", "primaria"];

export const LEVEL_LABEL: Record<EducationLevel, string> = {
  inicial: "Inicial",
  primaria: "Primaria",
  secundaria: "Secundaria",
};

export type LevelPolicy = {
  readonly level: EducationLevel;
  readonly palette: ReadonlySet<Block["kind"] | Command>;
  readonly maps: readonly GameMap[];
  /** Mapa para la etapa `stage` (0-based). Rota si hay más preguntas que mapas. */
  mapFor(stage: number): GameMap;
};

const definePolicy = (
  level: EducationLevel,
  palette: readonly (Block["kind"] | Command)[],
  maps: readonly GameMap[],
): LevelPolicy => ({
  level,
  palette: new Set(palette),
  maps,
  mapFor(stage) {
    if (!Number.isInteger(stage) || stage < 0) throw new RangeError(`Etapa no válida: ${stage}`);
    const map = maps[stage % maps.length];
    if (!map) throw new RangeError("La política no tiene mapas.");
    return map;
  },
});

// Inicial: recorridos cortos con los cuatro movimientos, sin bucles.
const INICIAL_MAPS = [
  parseMap("inicial-1", ["S..G"], 90),
  parseMap("inicial-2", ["S.#", "#.#", "#.G"], 90),
  parseMap("inicial-3", ["S..#", "##.#", "##.G"], 90),
  parseMap("inicial-4", ["#G..", "##.#", "S..#"], 90),
  parseMap("inicial-5", ["S...", "###.", "G...", "####"], 90),
];

// Primaria: caminos más largos donde "repetir" ahorra bloques.
const PRIMARIA_MAPS = [
  parseMap("primaria-1", ["S.....G"], 90),
  parseMap("primaria-2", ["S..#####", "##...###", "####...G"], 90),
  parseMap("primaria-3", ["S.#.#.#", "#...#.#", "###...G"], 90),
];

export const LEVEL_POLICIES: Record<EducationLevel, LevelPolicy> = {
  inicial: definePolicy("inicial", ["FORWARD", "BACKWARD", "TURN_LEFT", "TURN_RIGHT"], INICIAL_MAPS),
  primaria: definePolicy(
    "primaria",
    ["FORWARD", "BACKWARD", "TURN_LEFT", "TURN_RIGHT", "repeat"],
    [...PRIMARIA_MAPS, ...INICIAL_MAPS],
  ),
  // Secundaria reutiliza Primaria mientras se diseñan sus mapas propios.
  secundaria: definePolicy(
    "secundaria",
    ["FORWARD", "BACKWARD", "TURN_LEFT", "TURN_RIGHT", "repeat"],
    [...PRIMARIA_MAPS],
  ),
};

export const policyFor = (level: EducationLevel): LevelPolicy => LEVEL_POLICIES[level];
