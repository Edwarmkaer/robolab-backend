import { describe, expect, it } from "vitest";
import {
  MAX_BLOCKS,
  MAX_COMMANDS,
  ProgramError,
  compile,
  countBlocks,
  move,
  parseProgram,
  repeat,
  usesOnly,
} from "./program";

describe("parseProgram", () => {
  it("acepta un programa bien formado", () => {
    const raw = JSON.parse(
      '[{"kind":"move","command":"FORWARD"},{"kind":"repeat","times":2,"body":[{"kind":"move","command":"TURN_LEFT"}]}]',
    );
    expect(parseProgram(raw)).toEqual([move("FORWARD"), repeat(2, [move("TURN_LEFT")])]);
  });

  it.each([
    ["no es lista", { kind: "move" }],
    ["comando inventado", [{ kind: "move", command: "FLY" }]],
    ["bloque nulo", [null]],
    ["cuerpo de bucle inválido", [{ kind: "repeat", times: 2, body: "x" }]],
  ])("rechaza %s", (_name, raw) => {
    expect(() => parseProgram(raw)).toThrowError(ProgramError);
  });

  it("limita la cantidad de bloques", () => {
    const raw = Array.from({ length: MAX_BLOCKS + 1 }, () => ({ kind: "move", command: "FORWARD" }));
    expect(() => parseProgram(raw)).toThrowError(/bloques/);
  });
});

describe("compile", () => {
  it("devuelve los movimientos en orden", () => {
    expect(compile([move("FORWARD"), move("TURN_RIGHT"), move("FORWARD")])).toEqual([
      "FORWARD",
      "TURN_RIGHT",
      "FORWARD",
    ]);
  });

  it("expande repetir, también anidado", () => {
    const program = [repeat(2, [move("FORWARD"), repeat(3, [move("TURN_LEFT")])])];
    expect(compile(program)).toEqual([
      "FORWARD",
      "TURN_LEFT",
      "TURN_LEFT",
      "TURN_LEFT",
      "FORWARD",
      "TURN_LEFT",
      "TURN_LEFT",
      "TURN_LEFT",
    ]);
  });

  it("un programa vacío no tiene comandos", () => {
    expect(compile([])).toEqual([]);
  });

  it.each([0, 1, 10, 2.5])("rechaza repetir %s veces", (times) => {
    expect(() => compile([repeat(times, [move("FORWARD")])])).toThrowError(ProgramError);
  });

  it("rechaza programas que pasan el límite de pasos", () => {
    const huge = repeat(9, [repeat(9, [repeat(9, [move("FORWARD")])])]);
    expect(9 * 9 * 9).toBeGreaterThan(MAX_COMMANDS);
    expect(() => compile([huge])).toThrowError(/supera/);
  });

  it("rechaza más de tres niveles de bucles", () => {
    const deep = repeat(2, [repeat(2, [repeat(2, [repeat(2, [move("FORWARD")])])])]);
    expect(() => compile([deep])).toThrowError(/anidados/);
  });

  it("rechaza bloques desconocidos que lleguen desde el cliente", () => {
    const forged = [{ kind: "move", command: "JUMP" }] as unknown as Parameters<typeof compile>[0];
    expect(() => compile(forged)).toThrowError(ProgramError);
  });
});

describe("countBlocks y usesOnly", () => {
  const program = [move("FORWARD"), repeat(2, [move("TURN_LEFT"), move("FORWARD")])];

  it("cuenta los bloques colocados, no los pasos expandidos", () => {
    expect(countBlocks(program)).toBe(4);
  });

  it("detecta bloques que el nivel no permite", () => {
    expect(usesOnly(program, new Set(["FORWARD", "TURN_LEFT"]))).toBe(false);
    expect(usesOnly(program, new Set(["FORWARD", "TURN_LEFT", "repeat"]))).toBe(true);
  });
});
