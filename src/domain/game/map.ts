/**
 * Mapas del minijuego.
 *
 * Se escriben como texto para que sean fáciles de leer y de revisar:
 *   S  inicio del robot (dentro del camino)
 *   G  meta: la estrella que desbloquea la pregunta
 *   .  camino
 *   #  pasto (fuera del camino)
 */

export type Heading = 0 | 90 | 180 | 270; // 0 = arriba, 90 = derecha, 180 = abajo, 270 = izquierda

export type Cell = { readonly row: number; readonly col: number };

export type GameMap = {
  readonly id: string;
  readonly rows: number;
  readonly cols: number;
  readonly start: Cell;
  readonly startHeading: Heading;
  readonly goal: Cell;
  readonly walkable: ReadonlySet<string>;
  /** Texto original del mapa, para dibujarlo. */
  readonly layout: readonly string[];
};

export const cellKey = (cell: Cell): string => `${cell.row},${cell.col}`;

export class MapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MapError";
  }
}

export function parseMap(id: string, layout: readonly string[], startHeading: Heading): GameMap {
  if (layout.length === 0) throw new MapError(`Mapa ${id} vacío.`);
  const cols = layout[0]?.length ?? 0;
  let start: Cell | null = null;
  let goal: Cell | null = null;
  const walkable = new Set<string>();

  layout.forEach((line, row) => {
    if (line.length !== cols) throw new MapError(`Mapa ${id}: la fila ${row} no tiene ${cols} columnas.`);
    [...line].forEach((ch, col) => {
      const cell = { row, col };
      if (ch === "S") {
        if (start) throw new MapError(`Mapa ${id}: hay más de un inicio.`);
        start = cell;
        walkable.add(cellKey(cell));
      } else if (ch === "G") {
        if (goal) throw new MapError(`Mapa ${id}: hay más de una meta.`);
        goal = cell;
        walkable.add(cellKey(cell));
      } else if (ch === ".") {
        walkable.add(cellKey(cell));
      } else if (ch !== "#") {
        throw new MapError(`Mapa ${id}: carácter no válido "${ch}".`);
      }
    });
  });

  if (!start) throw new MapError(`Mapa ${id}: falta el inicio (S).`);
  if (!goal) throw new MapError(`Mapa ${id}: falta la meta (G).`);
  return { id, rows: layout.length, cols, start, goal, startHeading, walkable, layout };
}

export const isWalkable = (map: GameMap, cell: Cell): boolean =>
  cell.row >= 0 &&
  cell.col >= 0 &&
  cell.row < map.rows &&
  cell.col < map.cols &&
  map.walkable.has(cellKey(cell));
