import { describe, expect, it } from "vitest";
import { COMMANDS } from "../game/program";
import { simulate } from "../game/simulator";
import { shortestSolution } from "../game/solve";
import { LIVE_MAZES, MAX_LIVE_COMMANDS, mazeFor, parseLiveProgram, editLiveProgram } from "./maze";

describe("laberintos en vivo", () => {
  it("los tres mapas admiten una solución dentro del límite", () => {
    expect(LIVE_MAZES).toHaveLength(3);
    for (const maze of LIVE_MAZES) {
      const map = mazeFor(maze.id);
      const solution = shortestSolution(map, new Set(COMMANDS));
      expect(solution).not.toBeNull();
      expect(solution!.length).toBeLessThanOrEqual(MAX_LIVE_COMMANDS);
      expect(simulate(map, solution!).outcome.kind).toBe("GOAL");
    }
    expect(mazeFor("jardin")).toMatchObject({ rows: 5, cols: 5 });
    expect(simulate(mazeFor("jardin"), ["FORWARD", "FORWARD", "TURN_RIGHT", "FORWARD", "FORWARD", "TURN_LEFT", "FORWARD", "FORWARD"]).outcome.kind).toBe("GOAL");
    expect(() => mazeFor("inexistente")).toThrow(/laberinto/);
  });
  it("rechaza comandos falsos y más de 60 y no muta al editar", () => {
    expect(() => parseLiveProgram(["GOAL"])).toThrow(/movimiento/);
    expect(() => parseLiveProgram(Array(61).fill("FORWARD"))).toThrow(/60/);
    expect(parseLiveProgram([])).toEqual([]);
    expect(editLiveProgram(["FORWARD"], "append", "TURN_RIGHT")).toEqual(["FORWARD", "TURN_RIGHT"]);
    expect(editLiveProgram(["FORWARD"], "undo")).toEqual([]);
    expect(editLiveProgram(["FORWARD"], "clear")).toEqual([]);
    expect(() => editLiveProgram([], "append")).toThrow(/movimiento/);
  });
});
