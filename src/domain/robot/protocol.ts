/**
 * Lo que recibe el robot físico (ESP32 por wifi). Es el mismo formato del
 * kit del equipo de 2025: una letra por paso, con los bucles ya desplegados.
 *   A avanzar · R retroceder · D girar a la derecha · Z girar a la izquierda
 */
import { ACCESS_CODE_ALPHABET, isValidAccessCode, normalizeAccessCode } from "../evaluation/accessCode";
import { type Command, ProgramError, compile, parseProgram } from "../game/program";

export const ROBOT_LETTER: Record<Command, string> = {
  FORWARD: "A",
  BACKWARD: "R",
  TURN_RIGHT: "D",
  TURN_LEFT: "Z",
};

/** Programa de bloques (sin validar, puede venir del navegador) → texto para el robot. */
export function toRobotText(program: unknown): string {
  const commands = compile(parseProgram(program));
  if (commands.length === 0) throw new ProgramError("EMPTY", "El programa está vacío.");
  return commands.map((c) => ROBOT_LETTER[c]).join("");
}

/** El código del robot usa el mismo alfabeto sin letras confusas que el de los alumnos. */
export const ROBOT_CODE_LENGTH = 6;
export const ROBOT_CODE_ALPHABET = ACCESS_CODE_ALPHABET;
export const normalizeRobotCode = normalizeAccessCode;
export const isValidRobotCode = isValidAccessCode;
