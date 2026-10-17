/**
 * Nombres de alumnos. Se escriben a mano o se pegan desde Excel, Word o
 * WhatsApp, así que llegan con espacios de más, caracteres invisibles y a
 * veces símbolos. Aquí se limpian y se validan; el formulario y el servidor
 * usan estas mismas funciones.
 */

export const NAME_MIN_LETTERS = 2;
export const NAME_MAX = 40;

export type NameCheck = { readonly ok: true; readonly name: string } | { readonly ok: false; readonly reason: string };

const ALLOWED_CHAR = /[\p{Script=Latin}\p{M} '.-]/u;
// Cada palabra empieza con letra; apóstrofo y guion van entre letras; punto solo al final (inicial).
const WORD = /^\p{Script=Latin}\p{M}*(?:['-]?\p{Script=Latin}\p{M}*)*\.?$/u;
const PARTICLES = new Set(["de", "del", "la", "las", "los", "y"]);

function normalize(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(/[‘’ʼ`´]/gu, "'")
    .replace(/[‐-―]/gu, "-")
    .replace(/\s+/gu, " ")
    .replace(/[\p{Cf}\p{Cc}]/gu, "")
    .replace(/ {2,}/g, " ")
    .trim();
}

const describeChar = (ch: string) => (/\p{L}/u.test(ch) ? `${ch} (letra de otro alfabeto)` : ch);

function titleCase(name: string): string {
  return name
    .toLocaleLowerCase("es")
    .split(" ")
    .map((word, i) =>
      i > 0 && PARTICLES.has(word) ? word : word.replace(/(^|['-])(\p{L})/gu, (_, sep: string, letter: string) => sep + letter.toLocaleUpperCase("es")),
    )
    .join(" ");
}

export function cleanStudentName(raw: string): NameCheck {
  const name = normalize(raw);

  const bad = [...new Set([...name].filter((ch) => !ALLOWED_CHAR.test(ch)))];
  if (bad.length > 0) {
    return { ok: false, reason: `Tiene caracteres no permitidos: ${bad.map(describeChar).join(" ")}. Usa solo letras.` };
  }
  if ([...name].length > NAME_MAX) return { ok: false, reason: `Muy largo: máximo ${NAME_MAX} caracteres.` };
  if ((name.match(/\p{L}/gu) ?? []).length < NAME_MIN_LETTERS) {
    return { ok: false, reason: `Muy corto: escribe al menos ${NAME_MIN_LETTERS} letras.` };
  }
  if (!name.split(" ").every((word) => WORD.test(word))) {
    return { ok: false, reason: "Revisa los signos: cada palabra empieza con una letra." };
  }

  const allLower = name === name.toLocaleLowerCase("es");
  const allUpper = name === name.toLocaleUpperCase("es");
  return { ok: true, name: allLower || allUpper ? titleCase(name) : name };
}

/** Clave para detectar repetidos: sin tildes, sin mayúsculas, espacios simples. */
export function nameKey(name: string): string {
  return name.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("es").replace(/\s+/g, " ").trim();
}

export type ListEntry =
  | { readonly input: string; readonly status: "ok"; readonly name: string }
  | { readonly input: string; readonly status: "invalid" | "duplicate"; readonly reason: string };

export type ParsedList = {
  readonly entries: readonly ListEntry[];
  /** Nombres listos para guardar, ya limpios. */
  readonly names: readonly string[];
  readonly problemCount: number;
};

const withInitial = (name: string) => `Agrega la inicial del apellido, por ejemplo «${name} P.».`;

/** Una lista pegada por el docente: un nombre por línea, o separados por comas. */
export function parseStudentList(text: string, existing: readonly string[]): ParsedList {
  const existingKeys = new Set(existing.map(nameKey));
  const seen = new Set<string>();
  const entries: ListEntry[] = [];
  const names: string[] = [];

  for (const piece of text.split(/[\n,;]+/)) {
    const input = piece.trim();
    if (input === "") continue;
    const result = cleanStudentName(input);
    if (!result.ok) {
      entries.push({ input, status: "invalid", reason: result.reason });
      continue;
    }
    const key = nameKey(result.name);
    if (existingKeys.has(key)) {
      entries.push({ input, status: "duplicate", reason: `Ya está en la clase. ${withInitial(result.name)}` });
    } else if (seen.has(key)) {
      entries.push({ input, status: "duplicate", reason: `Está repetido en la lista. ${withInitial(result.name)}` });
    } else {
      seen.add(key);
      names.push(result.name);
      entries.push({ input, status: "ok", name: result.name });
    }
  }
  return { entries, names, problemCount: entries.length - names.length };
}
