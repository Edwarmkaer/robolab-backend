/** Un correo se guarda y se compara sin espacios y en minúsculas. */
export const normalizeEmail = (email: string) => email.trim().toLowerCase();
