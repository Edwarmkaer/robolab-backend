/**
 * Programa por bloques (AST) y su intérprete.
 *
 * El alumno arma una lista de bloques. Un bloque es un movimiento o un
 * "repetir" que contiene otros bloques. `compile` expande el árbol a la
 * secuencia plana de comandos que ejecutan el simulador y el robot.
 */

export type Command = "FORWARD" | "BACKWARD" | "TURN_LEFT" | "TURN_RIGHT";

export const COMMANDS: readonly Command[] = ["FORWARD", "BACKWARD", "TURN_LEFT", "TURN_RIGHT"];

export type MoveBlock = { readonly kind: "move"; readonly command: Command };
export type RepeatBlock = {
  readonly kind: "repeat";
  readonly times: number;
  readonly body: readonly Block[];
};
export type Block = MoveBlock | RepeatBlock;
export type Program = readonly Block[];

/** Límite de comandos para que un bucle mal armado no congele la app. */
export const MAX_COMMANDS = 200;
export const MIN_REPEAT = 2;
export const MAX_REPEAT = 9;
export const MAX_DEPTH = 3;

export class ProgramError extends Error {
  constructor(
    readonly code: "TOO_LONG" | "INVALID_REPEAT" | "TOO_DEEP" | "UNKNOWN_BLOCK" | "EMPTY",
    message: string,
  ) {
    super(message);
    this.name = "ProgramError";
  }
}

export const move = (command: Command): MoveBlock => ({ kind: "move", command });
export const repeat = (times: number, body: readonly Block[]): RepeatBlock => ({
  kind: "repeat",
  times,
  body,
});

export function compile(program: Program): Command[] {
  const out: Command[] = [];
  const visit = (blocks: readonly Block[], depth: number): void => {
    if (depth > MAX_DEPTH) {
      throw new ProgramError("TOO_DEEP", `Se permiten hasta ${MAX_DEPTH} bucles anidados.`);
    }
    for (const block of blocks) {
      if (block.kind === "move") {
        if (!COMMANDS.includes(block.command)) {
          throw new ProgramError("UNKNOWN_BLOCK", `Bloque desconocido: ${String(block.command)}`);
        }
        out.push(block.command);
      } else if (block.kind === "repeat") {
        if (!Number.isInteger(block.times) || block.times < MIN_REPEAT || block.times > MAX_REPEAT) {
          throw new ProgramError(
            "INVALID_REPEAT",
            `"Repetir" acepta de ${MIN_REPEAT} a ${MAX_REPEAT} veces.`,
          );
        }
        for (let i = 0; i < block.times; i++) visit(block.body, depth + 1);
      } else {
        throw new ProgramError("UNKNOWN_BLOCK", "Bloque desconocido.");
      }
      if (out.length > MAX_COMMANDS) {
        throw new ProgramError("TOO_LONG", `El programa supera ${MAX_COMMANDS} pasos.`);
      }
    }
  };
  visit(program, 0);
  return out;
}

/** Ruta de un bloque dentro del programa: [índice raíz, índice en el bucle, …]. */
export type BlockPath = readonly number[];

/**
 * Como `compile`, pero recuerda de qué bloque salió cada comando. Sirve para
 * resaltar el bloque que se está ejecutando o el que provocó el error.
 */
export function compileWithSource(program: Program): { command: Command; source: BlockPath }[] {
  const commands = compile(program); // valida límites y bloques con las mismas reglas
  const sources: BlockPath[] = [];
  const visit = (blocks: readonly Block[], prefix: BlockPath): void => {
    blocks.forEach((block, i) => {
      const path = [...prefix, i];
      if (block.kind === "move") sources.push(path);
      else for (let r = 0; r < block.times; r++) visit(block.body, path);
    });
  };
  visit(program, []);
  return commands.map((command, i) => ({ command, source: sources[i] ?? [] }));
}

/** Máximo de bloques que puede colocar el alumno (no de pasos expandidos). */
export const MAX_BLOCKS = 60;

/**
 * Valida datos sin tipo (por ejemplo, lo que llega del navegador al servidor)
 * y los convierte en un `Program`. Nunca confía en la forma recibida.
 */
export function parseProgram(input: unknown): Program {
  let blocks = 0;
  const parseList = (value: unknown, depth: number): Block[] => {
    if (!Array.isArray(value)) throw new ProgramError("UNKNOWN_BLOCK", "El programa debe ser una lista.");
    if (depth > MAX_DEPTH) {
      throw new ProgramError("TOO_DEEP", `Se permiten hasta ${MAX_DEPTH} bucles anidados.`);
    }
    return value.map((item): Block => {
      blocks += 1;
      if (blocks > MAX_BLOCKS) {
        throw new ProgramError("TOO_LONG", `Se permiten hasta ${MAX_BLOCKS} bloques.`);
      }
      if (typeof item !== "object" || item === null) {
        throw new ProgramError("UNKNOWN_BLOCK", "Bloque desconocido.");
      }
      const record = item as Record<string, unknown>;
      if (record.kind === "move" && COMMANDS.includes(record.command as Command)) {
        return move(record.command as Command);
      }
      if (record.kind === "repeat" && typeof record.times === "number") {
        return repeat(record.times, parseList(record.body, depth + 1));
      }
      throw new ProgramError("UNKNOWN_BLOCK", "Bloque desconocido.");
    });
  };
  return parseList(input, 0);
}

/** Cantidad de bloques que el alumno colocó (no la de pasos expandidos). */
export function countBlocks(program: Program): number {
  return program.reduce(
    (total, block) => total + 1 + (block.kind === "repeat" ? countBlocks(block.body) : 0),
    0,
  );
}

/** ¿El programa usa algún bloque fuera de los permitidos para el nivel? */
export function usesOnly(program: Program, allowed: ReadonlySet<Block["kind"] | Command>): boolean {
  return program.every((block) =>
    block.kind === "move"
      ? allowed.has(block.command)
      : allowed.has("repeat") && usesOnly(block.body, allowed),
  );
}
