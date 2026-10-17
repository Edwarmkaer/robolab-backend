/**
 * Protocolo del robot físico, según el contrato del equipo (robot-protocol.md).
 *
 * Programa (web → robot): texto ASCII, solo A R D Z, de 1 a 128 letras, sin
 * espacios ni saltos de línea, con los bucles ya desplegados.
 *   A  avanzar 1 casilla        R  retroceder 1 casilla (sin girar)
 *   D  girar: dir = (dir + 270) % 360   Z  girar: dir = (dir + 90) % 360
 * con dir 0 arriba, 90 derecha, 180 abajo, 270 izquierda (vista desde arriba).
 * Es decir: D gira a la izquierda y Z a la derecha, como el firmware actual.
 *
 * Respuestas (robot → web), opcionales: OK, RUN, DONE o ERR:<código>.
 */
import { ACCESS_CODE_ALPHABET, isValidAccessCode, normalizeAccessCode } from "../evaluation/accessCode";
import type { Heading } from "../game/map";
import { type Command, ProgramError, compile, parseProgram } from "../game/program";

export const MAX_SEQUENCE = 128;

export const ROBOT_LETTER: Record<Command, string> = {
  FORWARD: "A",
  BACKWARD: "R",
  TURN_LEFT: "D",
  TURN_RIGHT: "Z",
};

/** Cómo gira el robot con cada letra (para el simulador y las pruebas). */
export const turnFor = (letter: "D" | "Z", dir: Heading): Heading =>
  ((dir + (letter === "D" ? 270 : 90)) % 360) as Heading;

/** Programa de bloques (sin validar, puede venir del navegador) → texto para el robot. */
export function toRobotText(program: unknown): string {
  const commands = compile(parseProgram(program));
  if (commands.length === 0) throw new ProgramError("EMPTY", "El programa está vacío.");
  if (commands.length > MAX_SEQUENCE) {
    throw new ProgramError("TOO_LONG", `El robot recibe hasta ${MAX_SEQUENCE} pasos y este programa tiene ${commands.length}.`);
  }
  return commands.map((c) => ROBOT_LETTER[c]).join("");
}

export type SequenceCheck = { readonly ok: true } | { readonly ok: false; readonly error: "BAD_CHAR" | "TOO_LONG" };

/** Valida una secuencia de letras tal como llega (por ejemplo, desde otra web). */
export function validateSequence(sequence: string): SequenceCheck {
  if (!/^[ARDZ]+$/.test(sequence)) return { ok: false, error: "BAD_CHAR" };
  if (sequence.length > MAX_SEQUENCE) return { ok: false, error: "TOO_LONG" };
  return { ok: true };
}

export type RobotReply = { readonly kind: "OK" | "RUN" | "DONE" } | { readonly kind: "ERR"; readonly code: string };

/** Lee una respuesta del robot; null si no es una de las del contrato. */
export function parseRobotReply(text: string): RobotReply | null {
  const reply = text.trim().toUpperCase();
  if (reply === "OK" || reply === "RUN" || reply === "DONE") return { kind: reply };
  const error = /^ERR:([A-Z_]{1,32})$/.exec(reply);
  return error ? { kind: "ERR", code: error[1]! } : null;
}

/** El código de emparejamiento usa el mismo alfabeto sin letras confusas que el de los alumnos. */
export const ROBOT_CODE_LENGTH = 6;
export const ROBOT_CODE_ALPHABET = ACCESS_CODE_ALPHABET;
export const normalizeRobotCode = normalizeAccessCode;
export const isValidRobotCode = isValidAccessCode;
