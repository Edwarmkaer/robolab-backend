import { type RandomSource, cryptoRandom } from "../evaluation/accessCode";

export const RESET_CODE_LENGTH = 6;

/** Código numérico de un solo uso, fácil de copiar desde el correo. */
export function generateNumericCode(length = RESET_CODE_LENGTH, random: RandomSource = cryptoRandom): string {
  // Rechazo de muestras: 256 no es múltiplo de 10, así que se descartan 250–255.
  const limit = 256 - (256 % 10);
  let code = "";
  while (code.length < length) {
    for (const byte of random(length * 2)) {
      if (byte < limit && code.length < length) code += String(byte % 10);
    }
  }
  return code;
}

/** "jo•••••••@gmail.com": confirma el destino sin mostrar el correo completo. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 1) return email;
  const local = email.slice(0, at);
  const visible = local.length >= 4 ? 2 : 1;
  return `${local.slice(0, visible)}${"•".repeat(local.length - visible)}${email.slice(at)}`;
}
