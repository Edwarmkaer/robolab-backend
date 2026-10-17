import { describe, expect, it } from "vitest";
import { move, repeat } from "../game/program";
import { simulate } from "../game/simulator";
import { parseMap } from "../game/map";
import {
  MAX_SEQUENCE,
  ROBOT_CODE_LENGTH,
  isValidRobotCode,
  normalizeRobotCode,
  parseRobotReply,
  toRobotText,
  turnFor,
  validateSequence,
} from "./protocol";

describe("protocolo del robot (contrato robot-protocol.md)", () => {
  it("D gira dir+270 y Z gira dir+90 (0 arriba, 90 derecha), igual que el firmware", () => {
    expect(turnFor("D", 0)).toBe(270);
    expect(turnFor("Z", 0)).toBe(90);
    expect(turnFor("Z", 270)).toBe(0);
  });

  it("cada bloque se traduce a la letra que gira igual que la pantalla", () => {
    const map = parseMap("libre", ["...", "...", ".S."], 0, { goalOptional: true });
    for (const command of ["TURN_LEFT", "TURN_RIGHT"] as const) {
      const onScreen = simulate(map, [command]).steps[0]!.state.heading;
      const letter = toRobotText([move(command)]);
      expect(turnFor(letter as "D" | "Z", 0), command).toBe(onScreen);
    }
  });

  it("escribe una letra por paso, sin espacios ni saltos, con los bucles desplegados", () => {
    expect(toRobotText([move("FORWARD"), move("FORWARD"), move("TURN_LEFT"), move("TURN_RIGHT"), repeat(2, [move("FORWARD")])])).toBe(
      "AADZAA",
    );
    expect(toRobotText([move("BACKWARD")])).toBe("R");
  });

  it("rechaza programas vacíos, mal formados o de más de 128 pasos", () => {
    expect(() => toRobotText([])).toThrow(/vacío/);
    expect(() => toRobotText([{ kind: "nada" }])).toThrow();
    expect(() => toRobotText([repeat(9, [repeat(9, [move("FORWARD"), move("FORWARD")])])])).toThrow(/128/);
  });

  it("valida una secuencia que llega de otra web", () => {
    expect(validateSequence("AADZAA")).toEqual({ ok: true });
    expect(validateSequence("AXA")).toEqual({ ok: false, error: "BAD_CHAR" });
    expect(validateSequence("aa")).toEqual({ ok: false, error: "BAD_CHAR" });
    expect(validateSequence("AA\n")).toEqual({ ok: false, error: "BAD_CHAR" });
    expect(validateSequence("")).toEqual({ ok: false, error: "BAD_CHAR" });
    expect(validateSequence("A".repeat(MAX_SEQUENCE))).toEqual({ ok: true });
    expect(validateSequence("A".repeat(MAX_SEQUENCE + 1))).toEqual({ ok: false, error: "TOO_LONG" });
  });

  it("entiende las respuestas del robot", () => {
    expect(parseRobotReply("OK\n")).toEqual({ kind: "OK" });
    expect(parseRobotReply(" run ")).toEqual({ kind: "RUN" });
    expect(parseRobotReply("DONE")).toEqual({ kind: "DONE" });
    expect(parseRobotReply("ERR:BUSY")).toEqual({ kind: "ERR", code: "BUSY" });
    expect(parseRobotReply("ERR:MOTOR\n")).toEqual({ kind: "ERR", code: "MOTOR" });
    expect(parseRobotReply("ERR:")).toBeNull();
    expect(parseRobotReply("HOLA")).toBeNull();
  });

  it("normaliza el código de emparejamiento como el de los alumnos", () => {
    expect(normalizeRobotCode(" k7q-4mz ")).toBe("K7Q4MZ");
    expect(isValidRobotCode("K7Q4MZ")).toBe(true);
    expect(isValidRobotCode("K7Q4M0")).toBe(false);
    expect(ROBOT_CODE_LENGTH).toBe(6);
  });
});
