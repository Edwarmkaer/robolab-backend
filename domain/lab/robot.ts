/**
 * Del laboratorio al robot físico. El alumno programa con flechas absolutas
 * (↑ ↓ ← →), pero el robot entiende movimientos relativos (avanzar, girar).
 * Aquí se traduce una cosa en la otra, para que el programa pase por el relé
 * actual (`robot.send`) sin tocar el protocolo.
 */
import { type GameMap, type Heading, parseMap } from "../game/map";
import { type MoveBlock, move } from "../game/program";
import { type Cell, type Dir, type Mission, cellKey, cellSet, sameCell, stationIndex } from "./mission";

/** El robot se coloca en la casilla de inicio mirando a la derecha, como en los mapas del juego. */
export const LAB_START_HEADING: Heading = 90;

const HEADING_FOR: Record<Dir, Heading> = { U: 0, R: 90, D: 180, L: 270 };

/** Hacia dónde mira el robot después de seguir las flechas (para dibujarlo). */
export const headingAfter = (arrows: readonly Dir[], startHeading: Heading = LAB_START_HEADING): Heading => {
  const last = arrows.at(-1);
  return last ? HEADING_FOR[last] : startHeading;
};

/**
 * Flechas absolutas → bloques relativos. Antes de cada avance gira lo justo:
 * un cuarto a la derecha o a la izquierda, o media vuelta (dos giros).
 */
export function arrowsToProgram(arrows: readonly Dir[], startHeading: Heading = LAB_START_HEADING): MoveBlock[] {
  const program: MoveBlock[] = [];
  let heading = startHeading;
  for (const dir of arrows) {
    const target = HEADING_FOR[dir];
    const turn = (target - heading + 360) % 360;
    if (turn === 90) program.push(move("TURN_RIGHT"));
    else if (turn === 270) program.push(move("TURN_LEFT"));
    else if (turn === 180) program.push(move("TURN_RIGHT"), move("TURN_RIGHT"));
    program.push(move("FORWARD"));
    heading = target;
  }
  return program;
}

/** Casilla del laboratorio ([fila, columna]) como casilla del juego de bloques. */
export const toGameCell = ([row, col]: Cell) => ({ row, col });

/**
 * El mismo tablero como mapa del juego de bloques: las paredes son pasto, las
 * estaciones son paradas y el terreno difícil es camino normal. Sirve para
 * comprobar con el simulador existente que la traducción recorre la misma ruta.
 */
export function missionToGameMap(mission: Mission, id = mission.id): GameMap {
  const walls = cellSet(mission.walls);
  const layout = Array.from({ length: mission.size }, (_, row) =>
    Array.from({ length: mission.size }, (_, col) => {
      const cell: Cell = [row, col];
      if (sameCell(cell, mission.start)) return "S";
      if (sameCell(cell, mission.goal)) return "G";
      if (walls.has(cellKey(cell))) return "#";
      return stationIndex(mission, cell) >= 0 ? "P" : ".";
    }).join(""),
  );
  return parseMap(id, layout, LAB_START_HEADING);
}
