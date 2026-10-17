import type { Command } from "../../domain/game/program";

/** Cómo se ve y se nombra cada bloque. El nombre se lee en voz alta. */
export const BLOCK_LOOK: Record<Command, { label: string; icon: string }> = {
  FORWARD: { label: "Avanzar", icon: "/bloques/avanzar.svg" },
  BACKWARD: { label: "Retroceder", icon: "/bloques/retroceder.svg" },
  TURN_LEFT: { label: "Girar a la izquierda", icon: "/bloques/girar-izquierda.svg" },
  TURN_RIGHT: { label: "Girar a la derecha", icon: "/bloques/girar-derecha.svg" },
};

export const REPEAT_LOOK = { label: "Repetir", icon: "/bloques/repetir.svg" };
