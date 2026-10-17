/**
 * Código de acceso del alumno (value object).
 *
 * Seis caracteres sin letras ni números que se confunden (0/O, 1/I/L), para
 * que un docente lo dicte o lo escriba en una tarjeta sin errores.
 */

export const ACCESS_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ACCESS_CODE_LENGTH = 6;

export type RandomSource = (length: number) => Uint8Array;

export const cryptoRandom: RandomSource = (length) => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
};

export function generateAccessCode(random: RandomSource = cryptoRandom): string {
  const alphabetSize = ACCESS_CODE_ALPHABET.length;
  // Rechazo de muestras para no sesgar la distribución (256 no es múltiplo de 31).
  const limit = 256 - (256 % alphabetSize);
  let code = "";
  while (code.length < ACCESS_CODE_LENGTH) {
    for (const byte of random(ACCESS_CODE_LENGTH * 2)) {
      if (byte < limit && code.length < ACCESS_CODE_LENGTH) {
        code += ACCESS_CODE_ALPHABET[byte % alphabetSize];
      }
    }
  }
  return code;
}

/** Acepta lo que escribe un niño: minúsculas, espacios o guiones. */
export function normalizeAccessCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, "");
}

export function isValidAccessCode(code: string): boolean {
  return (
    code.length === ACCESS_CODE_LENGTH && [...code].every((ch) => ACCESS_CODE_ALPHABET.includes(ch))
  );
}

/** Token de sesión opaco para el alumno (32 bytes en hexadecimal). */
export function generateSessionToken(random: RandomSource = cryptoRandom): string {
  return [...random(32)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
