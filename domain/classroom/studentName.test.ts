import { describe, expect, it } from "vitest";
import { NICKNAME_MAX, cleanNickname, cleanStudentName, nameKey, parseStudentList } from "./studentName";

const ok = (raw: string) => {
  const r = cleanStudentName(raw);
  if (!r.ok) throw new Error(`esperaba válido: ${raw} → ${r.reason}`);
  return r.name;
};
const reason = (raw: string) => {
  const r = cleanStudentName(raw);
  if (r.ok) throw new Error(`esperaba inválido: ${raw}`);
  return r.reason;
};

describe("nombre de alumno", () => {
  it("acepta nombres reales con tildes, ñ, apóstrofes, guiones e iniciales", () => {
    expect(ok("María José")).toBe("María José");
    expect(ok("Ñusta")).toBe("Ñusta");
    expect(ok("D’Angelo")).toBe("D'Angelo");
    expect(ok("Ana-Lucía")).toBe("Ana-Lucía");
    expect(ok("Ana P.")).toBe("Ana P.");
    expect(ok("Ch'aska")).toBe("Ch'aska");
  });

  it("ordena espacios y quita caracteres invisibles pegados desde otro programa", () => {
    expect(ok("  Ana \t  María  ")).toBe("Ana María");
    expect(ok("Ana María")).toBe("Ana María");
    expect(ok("A​na")).toBe("Ana");
    // Tilde escrita como carácter aparte (NFD): se une a su letra.
    expect(ok("José")).toBe("José");
  });

  it("pone mayúscula inicial si todo vino en minúsculas o en mayúsculas", () => {
    expect(ok("ana maría")).toBe("Ana María");
    expect(ok("MARÍA DE LOS ÁNGELES")).toBe("María de los Ángeles");
    expect(ok("d'angelo")).toBe("D'Angelo");
    expect(ok("McKenzie")).toBe("McKenzie"); // mezcla: se respeta
  });

  it("rechaza números, símbolos y emojis diciendo cuáles", () => {
    expect(reason("Ana3")).toBe("Tiene caracteres no permitidos: 3. Usa solo letras.");
    expect(reason("<b>Ana</b>")).toBe("Tiene caracteres no permitidos: < > /. Usa solo letras.");
    expect(reason("Ana 😀")).toBe("Tiene caracteres no permitidos: 😀. Usa solo letras.");
    expect(reason("Ana@#")).toBe("Tiene caracteres no permitidos: @ #. Usa solo letras.");
  });

  it("rechaza letras de otros alfabetos que se ven iguales a las latinas", () => {
    // La "а" es cirílica: a simple vista es "Ana".
    expect(reason("Аna")).toMatch(/no permitidos/);
  });

  it("revisa largo y signos sueltos", () => {
    expect(reason("A")).toBe("Muy corto: escribe al menos 2 letras.");
    expect(reason("A.")).toBe("Muy corto: escribe al menos 2 letras.");
    expect(reason("A".repeat(41))).toBe("Muy largo: máximo 40 caracteres.");
    expect(reason("Ana -")).toBe("Revisa los signos: cada palabra empieza con una letra.");
    expect(reason("Ana--María")).toBe("Revisa los signos: cada palabra empieza con una letra.");
    expect(reason("'Ana")).toBe("Revisa los signos: cada palabra empieza con una letra.");
  });

  it("compara nombres sin importar tildes ni mayúsculas", () => {
    expect(nameKey("José  María")).toBe(nameKey("jose maria"));
    expect(nameKey("Ana")).not.toBe(nameKey("Ana P."));
  });
});

describe("lista de alumnos", () => {
  it("separa por líneas, comas o punto y coma, y marca cada problema", () => {
    const parsed = parseStudentList("Ana, beto\nCarla3;\n\n  ;José\nana", ["José"]);
    expect(parsed.entries.map((e) => [e.input, e.status, e.status === "ok" ? e.name : e.reason])).toEqual([
      ["Ana", "ok", "Ana"],
      ["beto", "ok", "Beto"],
      ["Carla3", "invalid", "Tiene caracteres no permitidos: 3. Usa solo letras."],
      ["José", "duplicate", "Ya está en la clase. Agrega la inicial del apellido, por ejemplo «José P.»."],
      ["ana", "duplicate", "Está repetido en la lista. Agrega la inicial del apellido, por ejemplo «Ana P.»."],
    ]);
    expect(parsed.names).toEqual(["Ana", "Beto"]);
    expect(parsed.problemCount).toBe(3);
  });

  it("una lista vacía no tiene nombres ni problemas", () => {
    expect(parseStudentList(" \n , ", [])).toEqual({ entries: [], names: [], problemCount: 0 });
  });
});

describe("apodo para unirse a la clase", () => {
  const nick = (raw: string) => {
    const r = cleanNickname(raw);
    return r.ok ? r.name : r.reason;
  };

  it("respeta cómo lo escribió el alumno; si vino todo en minúsculas o mayúsculas, solo pone la primera", () => {
    expect(nick("pingüino veloz")).toBe("Pingüino veloz");
    expect(nick("PUMA RÁPIDO")).toBe("Puma rápido");
    expect(nick("Zorro Curioso")).toBe("Zorro Curioso");
    expect(nick("  cóndor   azul ")).toBe("Cóndor azul");
  });

  it("usa las mismas reglas de letras que un nombre, pero más corto", () => {
    expect(nick("Ana3")).toBe("Tiene caracteres no permitidos: 3. Usa solo letras.");
    expect(nick("x")).toBe("Muy corto: escribe al menos 2 letras.");
    expect(nick("a".repeat(24))).toHaveLength(24);
    expect(nick("a".repeat(25))).toBe(`Muy largo: máximo ${NICKNAME_MAX} caracteres.`);
    expect(NICKNAME_MAX).toBe(24);
  });
});
