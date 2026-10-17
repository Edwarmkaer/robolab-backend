import { describe, expect, it } from "vitest";
import { generateNumericCode, maskEmail } from "./codes";
import { checkPassword, isStrongPassword, passwordProblem } from "./password";

describe("contraseña", () => {
  it("exige minúscula, mayúscula, número, símbolo y 8 caracteres", () => {
    expect(isStrongPassword("Clave#2026")).toBe(true);
    expect(isStrongPassword("Ñandú-2026")).toBe(true);
    expect(isStrongPassword("clave#2026")).toBe(false); // sin mayúscula
    expect(isStrongPassword("CLAVE#2026")).toBe(false); // sin minúscula
    expect(isStrongPassword("Clave#clave")).toBe(false); // sin número
    expect(isStrongPassword("Clave 2026")).toBe(false); // el espacio no es símbolo
    expect(isStrongPassword("Cl#26a")).toBe(false); // corta
  });

  it("dice qué regla cumple cada parte, para la lista en vivo", () => {
    const checks = checkPassword("abc");
    expect(checks.map((c) => [c.id, c.ok])).toEqual([
      ["length", false],
      ["lower", true],
      ["upper", false],
      ["number", false],
      ["symbol", false],
    ]);
  });

  it("explica en una frase lo que falta", () => {
    expect(passwordProblem("Clave#2026")).toBeNull();
    expect(passwordProblem("clave2026")).toBe("La contraseña necesita una mayúscula y un símbolo (! @ # $ % * ?).");
    expect(passwordProblem("CLAVE#2026")).toBe("La contraseña necesita una minúscula.");
    expect(passwordProblem(`Aa1#${"x".repeat(130)}`)).toMatch(/hasta 128/);
  });
});

describe("código de recuperación", () => {
  it("tiene 6 dígitos y no se sesga (rechaza bytes de 250 en adelante)", () => {
    const bytes = [255, 250, 0, 9, 19, 249, 123, 45, 67];
    const random = (n: number) => Uint8Array.from(bytes.splice(0, n));
    expect(generateNumericCode(6, random)).toBe("099935");
  });

  it("usa el azar del sistema por defecto", () => {
    const a = generateNumericCode();
    expect(a).toMatch(/^\d{6}$/);
  });

  it("oculta el correo al mostrar a dónde se envió", () => {
    expect(maskEmail("jorge.laban@gmail.com")).toBe("jo•••••••••@gmail.com");
    expect(maskEmail("ana@colegio.pe")).toBe("a••@colegio.pe");
    expect(maskEmail("x@y.pe")).toBe("x@y.pe");
  });
});
