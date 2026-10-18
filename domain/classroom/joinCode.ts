/**
 * Código de clase (value object): con él los alumnos se unen a su clase sin
 * cuenta ni lista previa. Tres letras, un guion y tres dígitos (ABC-123),
 * sin las letras que se confunden con números (O, I, L), para que el docente
 * lo escriba en la pizarra o lo dicte sin errores.
 */
import { type RandomSource, cryptoRandom } from "../evaluation/accessCode";

export const JOIN_CODE_LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZ";
export const JOIN_CODE_DIGITS = "0123456789";
/** Largo del código ya normalizado, con el guion. */
export const JOIN_CODE_LENGTH = 7;

const PATTERN = /^[ABCDEFGHJKMNPQRSTUVWXYZ]{3}-[0-9]{3}$/;

/** Toma `count` símbolos del alfabeto con rechazo de muestras: 256 no es múltiplo de 23 ni de 10. */
function pick(alphabet: string, count: number, random: RandomSource): string {
  const limit = 256 - (256 % alphabet.length);
  let out = "";
  while (out.length < count) {
    for (const byte of random(count * 2)) {
      if (byte < limit && out.length < count) out += alphabet[byte % alphabet.length];
    }
  }
  return out;
}

export function generateJoinCode(random: RandomSource = cryptoRandom): string {
  return `${pick(JOIN_CODE_LETTERS, 3, random)}-${pick(JOIN_CODE_DIGITS, 3, random)}`;
}

/**
 * Acepta lo que escribe un niño: minúsculas, espacios, sin guion o con un
 * guion largo. Devuelve el código en su forma canónica (ABC-123) cuando tiene
 * seis símbolos; si no, lo devuelve limpio para que `isValidJoinCode` lo rechace.
 */
export function normalizeJoinCode(input: string): string {
  const compact = input.toUpperCase().replace(/[\s\-‐-―−_]/gu, "");
  if (compact.length !== 6) return compact;
  // En la parte numérica una "O" solo puede ser un cero.
  return `${compact.slice(0, 3)}-${compact.slice(3).replace(/O/g, "0")}`;
}

export function isValidJoinCode(code: string): boolean {
  return PATTERN.test(code);
}
