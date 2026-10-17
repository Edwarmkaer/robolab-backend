import { describe, expect, it } from "vitest";
import { move, repeat } from "../game/program";
import { ROBOT_CODE_LENGTH, isValidRobotCode, normalizeRobotCode, toRobotText } from "./protocol";

describe("protocolo del robot", () => {
  it("escribe una letra por paso, con los bucles ya desplegados (como el kit de 2025)", () => {
    expect(toRobotText([move("FORWARD"), move("FORWARD"), move("TURN_RIGHT"), repeat(2, [move("FORWARD")])])).toBe("AADAA");
    expect(toRobotText([move("BACKWARD"), move("TURN_LEFT")])).toBe("RZ");
  });

  it("rechaza programas vacíos o mal formados", () => {
    expect(() => toRobotText([])).toThrow(/vacío/);
    expect(() => toRobotText([{ kind: "nada" }])).toThrow();
  });

  it("normaliza el código del robot como el de los alumnos", () => {
    expect(normalizeRobotCode(" k7q-4mz ")).toBe("K7Q4MZ");
    expect(isValidRobotCode("K7Q4MZ")).toBe(true);
    expect(isValidRobotCode("K7Q4M0")).toBe(false); // el 0 no se usa: se confunde con la O
    expect(ROBOT_CODE_LENGTH).toBe(6);
  });
});
