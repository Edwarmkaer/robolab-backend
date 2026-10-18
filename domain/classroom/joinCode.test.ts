import { describe, expect, it } from "vitest";
import { JOIN_CODE_LETTERS, generateJoinCode, isValidJoinCode, normalizeJoinCode } from "./joinCode";

/** Fuente de azar de prueba: devuelve los bytes dados, en orden, y después ceros. */
const bytes = (...values: number[]) => {
  const queue = [...values];
  return (length: number) => Uint8Array.from({ length }, () => queue.shift() ?? 0);
};

describe("código de clase", () => {
  it("tiene tres letras, un guion y tres dígitos, sin O, I ni L", () => {
    for (let i = 0; i < 300; i++) {
      const code = generateJoinCode();
      expect(code).toMatch(/^[A-Z]{3}-[0-9]{3}$/);
      expect(code).not.toMatch(/[OIL]/);
      expect(isValidJoinCode(code)).toBe(true);
    }
    expect(JOIN_CODE_LETTERS).not.toMatch(/[OIL]/);
  });

  it("toma letras y dígitos del azar sin sesgo: descarta los bytes que sobran", () => {
    // La fuente entrega 6 bytes por llamada (letras y luego dígitos); 256 no es múltiplo de 23 ni de 10, así que los bytes altos se descartan.
    expect(generateJoinCode(bytes(0, 1, 2, 0, 0, 0, 0, 1, 2))).toBe("ABC-012");
    expect(generateJoinCode(bytes(253, 254, 255, 0, 1, 2, 250, 255, 7, 8, 9))).toBe("ABC-789");
  });

  it("acepta lo que escribe un niño: minúsculas, espacios, sin guion o con otro guion", () => {
    expect(normalizeJoinCode("tec-482")).toBe("TEC-482");
    expect(normalizeJoinCode("  tec 482 ")).toBe("TEC-482");
    expect(normalizeJoinCode("tec482")).toBe("TEC-482");
    expect(normalizeJoinCode("TEC–482")).toBe("TEC-482"); // guion largo
    expect(normalizeJoinCode("TEC — 482")).toBe("TEC-482");
    // La "O" en la parte de los números solo puede ser un cero.
    expect(normalizeJoinCode("tec-48o")).toBe("TEC-480");
  });

  it("rechaza códigos incompletos, con letras prohibidas o sin normalizar", () => {
    expect(isValidJoinCode("TEO-482")).toBe(false);
    expect(isValidJoinCode("TEC-48")).toBe(false);
    expect(isValidJoinCode("TEC-4821")).toBe(false);
    expect(isValidJoinCode("tec-482")).toBe(false);
    expect(isValidJoinCode("TEC482")).toBe(false);
    expect(isValidJoinCode("482-TEC")).toBe(false);
    expect(isValidJoinCode("")).toBe(false);
    expect(isValidJoinCode(normalizeJoinCode("tec-48"))).toBe(false);
  });
});
