/**
 * Reglas de la contraseña del docente. Las usa el formulario para mostrar
 * qué falta mientras se escribe y el servidor para rechazar las débiles:
 * es una sola definición, así que nunca se contradicen.
 */

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export type PasswordRule = {
  readonly id: "length" | "lower" | "upper" | "number" | "symbol";
  /** Texto para la lista que ve el docente. */
  readonly label: string;
  /** Lo que falta, para el mensaje de error del servidor. */
  readonly missing: string;
  readonly test: (password: string) => boolean;
};

export const PASSWORD_RULES: readonly PasswordRule[] = [
  {
    id: "length",
    label: `Al menos ${PASSWORD_MIN} caracteres`,
    missing: `al menos ${PASSWORD_MIN} caracteres`,
    test: (p) => [...p].length >= PASSWORD_MIN && [...p].length <= PASSWORD_MAX,
  },
  { id: "lower", label: "Una minúscula", missing: "una minúscula", test: (p) => /\p{Ll}/u.test(p) },
  { id: "upper", label: "Una mayúscula", missing: "una mayúscula", test: (p) => /\p{Lu}/u.test(p) },
  { id: "number", label: "Un número", missing: "un número", test: (p) => /\p{Nd}/u.test(p) },
  {
    id: "symbol",
    label: "Un símbolo, como # $ !",
    missing: "un símbolo (! @ # $ % * ?)",
    // Cualquier carácter visible que no sea letra ni número; el espacio no cuenta.
    test: (p) => /[^\p{L}\p{N}\p{M}\s]/u.test(p),
  },
];

export type RuleCheck = { readonly id: PasswordRule["id"]; readonly label: string; readonly ok: boolean };

export function checkPassword(password: string): RuleCheck[] {
  return PASSWORD_RULES.map((rule) => ({ id: rule.id, label: rule.label, ok: rule.test(password) }));
}

export function isStrongPassword(password: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(password));
}

/** "La contraseña necesita una mayúscula y un número." o null si cumple todo. */
export function passwordProblem(password: string): string | null {
  if ([...password].length > PASSWORD_MAX) return `La contraseña puede tener hasta ${PASSWORD_MAX} caracteres.`;
  const missing = PASSWORD_RULES.filter((rule) => !rule.test(password)).map((rule) => rule.missing);
  if (missing.length === 0) return null;
  const list = missing.length === 1 ? missing[0] : `${missing.slice(0, -1).join(", ")} y ${missing.at(-1)}`;
  return `La contraseña necesita ${list}.`;
}
