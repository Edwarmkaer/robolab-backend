/**
 * Búsqueda en anchura sobre (celda, orientación, paradas visitadas): el
 * programa más corto, con los comandos permitidos, que llega a la meta
 * después de pasar por todas las paradas. Sirve para comprobar que un mapa
 * o un reto se pueden resolver; devuelve null si no hay forma.
 */
import { type GameMap, cellKey } from "./map";
import { COMMANDS, type Command } from "./program";
import { simulate } from "./simulator";

export function shortestSolution(map: GameMap, palette: ReadonlySet<string>): Command[] | null {
  const commands = COMMANDS.filter((c) => palette.has(c));
  const stopBit = new Map(map.stops.map((stop, i) => [cellKey(stop), 1 << i]));
  const allStops = (1 << map.stops.length) - 1;
  const startMask = stopBit.get(cellKey(map.start)) ?? 0;
  const startKey = `${cellKey(map.start)}@${map.startHeading}#${startMask}`;
  const queue: { path: Command[] }[] = [{ path: [] }];
  const seen = new Set([startKey]);
  while (queue.length > 0) {
    const { path } = queue.shift()!;
    for (const command of commands) {
      const candidate = [...path, command];
      const run = simulate(map, candidate);
      const mask = run.steps.reduce((m, s) => m | (stopBit.get(cellKey(s.state.cell)) ?? 0), startMask);
      if (run.outcome.kind === "GOAL") {
        if (mask === allStops) return candidate;
        continue; // llegó a la meta sin pasar por todas las paradas: camino muerto
      }
      if (run.outcome.kind !== "INCOMPLETE") continue;
      const last = run.steps.at(-1)!.state;
      const key = `${cellKey(last.cell)}@${last.heading}#${mask}`;
      if (!seen.has(key)) {
        seen.add(key);
        queue.push({ path: candidate });
      }
    }
  }
  return null;
}
