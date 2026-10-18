import { type GameMap, type Heading, parseMap } from "../game/map";
import { COMMANDS, type Command } from "../game/program";

export type LiveMode = "race" | "cooperative";
export type LiveStatus = "waiting" | "running" | "closed";
export const MAX_LIVE_COMMANDS = 60;
export const MAX_LIVE_PARTICIPANTS = 100;

export const LIVE_MAZES: readonly { id: string; title: string; layout: readonly string[]; startHeading: Heading }[] = [
  { id: "jardin", title: "Jardín de caminos", layout: ["##G..", "##.##", "...##", ".#.##", "S..##"], startHeading: 0 },
  { id: "sendero", title: "Sendero del robot", layout: ["S...#", "##..#", "#...#", "#.#.#", "#..G#"], startHeading: 90 },
  { id: "vueltas", title: "Muchas vueltas", layout: ["S....#", "###..#", "#....#", "#.####", "#....G", "######"], startHeading: 90 },
];

export function mazeFor(id: string): GameMap {
  const maze = LIVE_MAZES.find((m) => m.id === id);
  if (!maze) throw new Error("No encontramos ese laberinto.");
  return parseMap(maze.id, maze.layout, maze.startHeading);
}

export function parseLiveProgram(input: unknown): Command[] {
  if (!Array.isArray(input) || !input.every((c) => COMMANDS.includes(c as Command))) {
    throw new Error("Elige movimientos válidos.");
  }
  if (input.length > MAX_LIVE_COMMANDS) throw new Error(`Usa hasta ${MAX_LIVE_COMMANDS} movimientos.`);
  return [...input] as Command[];
}

export function editLiveProgram(program: readonly Command[], action: "append" | "undo" | "clear", command?: Command): Command[] {
  if (action === "clear") return [];
  if (action === "undo") return program.slice(0, -1);
  return parseLiveProgram([...program, command]);
}
