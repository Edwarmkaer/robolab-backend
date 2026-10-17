import { ConvexError } from "convex/values";

/**
 * Mensaje legible para el usuario. Los errores de negocio llegan como
 * ConvexError con un texto ya pensado para mostrarse; cualquier otro error se
 * reemplaza por un mensaje genérico para no filtrar detalles internos.
 */
export function userMessage(error: unknown, fallback = "Algo salió mal. Intenta de nuevo."): string {
  if (error instanceof ConvexError && typeof error.data === "string") return error.data;
  if (error instanceof Error && /InvalidSecret|InvalidAccountId/.test(error.message)) {
    return "Correo o contraseña incorrectos.";
  }
  return fallback;
}
