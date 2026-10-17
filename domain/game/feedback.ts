/**
 * Retroalimentación determinista para el alumno.
 *
 * El diagnóstico sale del simulador, no de un modelo de lenguaje: así nunca
 * describe un error que no ocurrió. Los textos son cortos para leerlos en voz
 * alta a niños de Inicial.
 */
import type { Outcome } from "./simulator";
import type { Command } from "./program";

export type Feedback = {
  readonly tone: "success" | "retry";
  readonly title: string;
  readonly detail: string;
  readonly highlightStep?: number;
};

const COMMAND_NAME: Record<Command, string> = {
  FORWARD: "avanzar",
  BACKWARD: "retroceder",
  TURN_LEFT: "girar a la izquierda",
  TURN_RIGHT: "girar a la derecha",
};

export function feedbackFor(outcome: Outcome): Feedback {
  switch (outcome.kind) {
    case "GOAL":
      return {
        tone: "success",
        title: "¡Llegaste a la estrella!",
        detail: "Ahora responde la pregunta.",
      };
    case "OFF_PATH":
      return {
        tone: "retry",
        title: "¡Uy! El robot se salió del camino.",
        detail: `Pasó en el paso ${outcome.failedStep}, al ${COMMAND_NAME[outcome.command]}. Revisa ese bloque.`,
        highlightStep: outcome.failedStep,
      };
    case "INCOMPLETE":
      return {
        tone: "retry",
        title: "¡Casi! Falta un poco.",
        detail: "El robot se quedó antes de la estrella. Agrega más bloques.",
      };
    case "EMPTY":
      return {
        tone: "retry",
        title: "Tu programa está vacío.",
        detail: "Toca las flechas para darle órdenes al robot.",
      };
  }
}
