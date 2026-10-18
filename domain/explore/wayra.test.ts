import { describe, expect, it } from "vitest";
import { MISSIONS } from "../lab/mission";
import { CHALLENGES } from "./challenges";
import { checkPrediction, checkProgram } from "./check";

const challenge = (id: string) => CHALLENGES.find((c) => c.id === id)!;

describe("el personaje se llama Wayra en todo lo que el niño lee y escucha", () => {
  it("el primer reto de Tecnología en Inicial dice que Wayra quiere llegar a la estrella", () => {
    expect(challenge("inicial-paseo").story).toBe("Wayra quiere llegar a la estrella. ¡Está en línea recta!");
  });

  it("ningún reto ni misión nombra a Kusi (historias, pistas y títulos)", () => {
    expect(JSON.stringify(CHALLENGES)).not.toMatch(/Kusi/);
    expect(JSON.stringify(MISSIONS)).not.toMatch(/Kusi/);
  });

  it("los mensajes al ejecutar también dicen Wayra", () => {
    const paseo = challenge("inicial-paseo");
    const messages = [
      checkProgram(paseo, []).result.message,
      checkProgram(paseo, [{ kind: "move", command: "FORWARD" }]).result.message,
      checkProgram(paseo, Array.from({ length: 5 }, () => ({ kind: "move" as const, command: "FORWARD" as const }))).result.message,
      checkProgram(paseo, Array.from({ length: 3 }, () => ({ kind: "move" as const, command: "FORWARD" as const }))).result.message,
    ];
    const predict = CHALLENGES.find((c) => c.kind === "predict")!;
    messages.push(checkPrediction(predict, { row: -1, col: -1 }).message);
    for (const message of messages) {
      expect(message).not.toMatch(/Kusi/);
      expect(message).toMatch(/Wayra|programa/);
    }
    expect(messages[3]).toBe("¡Lo lograste! Wayra llegó a la estrella.");
  });
});
