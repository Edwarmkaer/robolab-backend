/**
 * Simulador determinista: dado un mapa y una secuencia de comandos, devuelve
 * el recorrido paso a paso y el resultado. Lo usan la animación del navegador
 * y el servidor, que vuelve a correrlo para validar el objetivo.
 */
import { type Cell, type GameMap, type Heading, isWalkable } from "./map";
import type { Command } from "./program";

export type RobotState = { readonly cell: Cell; readonly heading: Heading };

export type Step = {
  readonly index: number; // 1-based, para mostrarlo a niños y docentes
  readonly command: Command;
  readonly state: RobotState;
};

export type Outcome =
  | { readonly kind: "GOAL"; readonly stepsUsed: number }
  | { readonly kind: "OFF_PATH"; readonly failedStep: number; readonly command: Command; readonly attempted: Cell }
  | { readonly kind: "INCOMPLETE"; readonly stepsUsed: number }
  | { readonly kind: "EMPTY" };

export type Simulation = {
  readonly initial: RobotState;
  readonly steps: readonly Step[];
  readonly outcome: Outcome;
};

const DELTAS: Record<Heading, Cell> = {
  0: { row: -1, col: 0 },
  90: { row: 0, col: 1 },
  180: { row: 1, col: 0 },
  270: { row: 0, col: -1 },
};

const turn = (heading: Heading, degrees: 90 | -90): Heading =>
  (((heading + degrees) % 360) + 360) % 360 as Heading;

const offset = (cell: Cell, heading: Heading, sign: 1 | -1): Cell => {
  const delta = DELTAS[heading];
  return { row: cell.row + sign * delta.row, col: cell.col + sign * delta.col };
};

const sameCell = (a: Cell, b: Cell): boolean => a.row === b.row && a.col === b.col;

export function simulate(map: GameMap, commands: readonly Command[]): Simulation {
  const initial: RobotState = { cell: map.start, heading: map.startHeading };
  if (commands.length === 0) return { initial, steps: [], outcome: { kind: "EMPTY" } };

  const steps: Step[] = [];
  let state = initial;

  for (const [i, command] of commands.entries()) {
    const index = i + 1;
    let next: RobotState;
    switch (command) {
      case "TURN_LEFT":
        next = { cell: state.cell, heading: turn(state.heading, -90) };
        break;
      case "TURN_RIGHT":
        next = { cell: state.cell, heading: turn(state.heading, 90) };
        break;
      case "FORWARD":
      case "BACKWARD": {
        const target = offset(state.cell, state.heading, command === "FORWARD" ? 1 : -1);
        if (!isWalkable(map, target)) {
          return {
            initial,
            steps,
            outcome: { kind: "OFF_PATH", failedStep: index, command, attempted: target },
          };
        }
        next = { cell: target, heading: state.heading };
        break;
      }
    }
    state = next;
    steps.push({ index, command, state });
    if (sameCell(state.cell, map.goal)) {
      return { initial, steps, outcome: { kind: "GOAL", stepsUsed: index } };
    }
  }
  return { initial, steps, outcome: { kind: "INCOMPLETE", stepsUsed: steps.length } };
}
