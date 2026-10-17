/**
 * Qué decirle al usuario sobre la conexión con el servidor. Sin esto, si el
 * internet se cae, los botones se quedan en "Ingresando…" sin explicación.
 */

/** Un pedido que tarda más que esto se considera lento. */
export const SLOW_REQUEST_MS = 10_000;

export type ConnectionSnapshot = {
  readonly isWebSocketConnected: boolean;
  readonly hasEverConnected: boolean;
  readonly connectionRetries: number;
  readonly timeOfOldestInflightRequest: Date | null;
};

export type ConnectionNotice = { readonly kind: "unreachable" | "lost" | "slow"; readonly message: string };

export function connectionNotice(state: ConnectionSnapshot, now: number): ConnectionNotice | null {
  if (!state.isWebSocketConnected) {
    if (state.hasEverConnected) {
      return { kind: "lost", message: "Se perdió la conexión con el servidor. Reintentando…" };
    }
    // El primer intento todavía está en curso: no hay que alarmar.
    if (state.connectionRetries === 0) return null;
    return {
      kind: "unreachable",
      message: "No podemos conectar con el servidor. Revisa tu internet; seguimos intentando.",
    };
  }
  const oldest = state.timeOfOldestInflightRequest;
  if (oldest && now - oldest.getTime() > SLOW_REQUEST_MS) {
    return { kind: "slow", message: "El servidor está tardando en responder. Espera un momento…" };
  }
  return null;
}
