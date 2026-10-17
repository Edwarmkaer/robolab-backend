/**
 * Adaptador WiFi para la interfaz RobotLink del contrato (robot-protocol.md, §6).
 * No importa nada (ni React ni Convex): otra web copia este archivo tal cual.
 *
 * Habla con las rutas del relé:
 *   POST {baseUrl}/robot/web/enviar   {"codigo","secuencia","id"}
 *   GET  {baseUrl}/robot/web/estado?codigo=…&id=…
 * baseUrl es la dirección de las rutas HTTP del backend (…convex.site).
 * El relé normaliza el código y valida las letras (ERR:BAD_CHAR, ERR:TOO_LONG);
 * aquí solo se traducen sus respuestas a eventos.
 */

export type RobotState = "off" | "connecting" | "connected" | "running" | "error";
export type RobotEvent =
  | { type: "state"; state: RobotState; message?: string }
  | { type: "received" }
  | { type: "done" }
  | { type: "failed"; reason: string };

export interface RobotLink {
  readonly transport: "ble" | "wifi" | "mock";
  readonly supported: boolean;
  connect(): Promise<void>;
  send(sequence: string): Promise<void>; // resuelve al ENVIAR, no al terminar
  disconnect(): Promise<void>;
  subscribe(listener: (e: RobotEvent) => void): () => void;
}

type Options = {
  readonly baseUrl: string;
  /** Pide el código de emparejamiento (por ejemplo, desde la ventana ROBOT). */
  readonly code: () => string | Promise<string>;
  readonly fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>;
  /** Cada cuánto se consulta el avance del programa. */
  readonly pollMs?: number;
  /** Si el robot no termina en este tiempo, se avisa como fallo. */
  readonly timeoutMs?: number;
};

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function createWifiLink({ baseUrl, code, fetchImpl = fetch, pollMs = 500, timeoutMs = 120_000 }: Options): RobotLink {
  const listeners = new Set<(e: RobotEvent) => void>();
  const emit = (e: RobotEvent) => listeners.forEach((l) => l(e));
  const base = baseUrl.replace(/\/$/, "");
  const statusUrl = (robotCode: string) => `${base}/robot/web/estado?codigo=${encodeURIComponent(robotCode)}`;
  let pairedCode: string | null = null;
  let polling: ReturnType<typeof setTimeout> | null = null;

  const stopPolling = () => {
    if (polling) clearTimeout(polling);
    polling = null;
  };

  async function readJson(response: Response): Promise<{ estado?: string | null; robot?: string; id?: string }> {
    return (await response.json().catch(() => ({}))) as { estado?: string | null; robot?: string; id?: string };
  }

  function follow(robotCode: string, id: string, startedAt: number, seen: Set<string>) {
    polling = setTimeout(async () => {
      try {
        const response = await fetchImpl(`${statusUrl(robotCode)}&id=${encodeURIComponent(id)}`);
        const estado = (await readJson(response)).estado ?? "";
        // El robot responde OK y RUN casi juntos: si una consulta se salta un paso,
        // se avisa igual, en orden (llegó → corre → terminó).
        const step = ["OK", "RUN", "DONE"].indexOf(estado);
        if (step >= 0 && !seen.has("OK")) {
          seen.add("OK");
          emit({ type: "received" });
        }
        if (step >= 1 && !seen.has("RUN")) {
          seen.add("RUN");
          emit({ type: "state", state: "running" });
        }
        if (estado === "DONE") {
          emit({ type: "done" });
          emit({ type: "state", state: "connected" });
          return;
        }
        if (estado.startsWith("ERR:") || estado === "VENCIDO") {
          emit({ type: "failed", reason: estado.startsWith("ERR:") ? estado.slice(4) : "TIMEOUT" });
          emit({ type: "state", state: "connected" });
          return;
        }
      } catch {
        // Un corte breve de red no detiene el seguimiento; se reintenta en la siguiente vuelta.
      }
      if (Date.now() - startedAt > timeoutMs) {
        emit({ type: "failed", reason: "TIMEOUT" });
        emit({ type: "state", state: "connected" });
        return;
      }
      follow(robotCode, id, startedAt, seen);
    }, pollMs);
  }

  return {
    transport: "wifi",
    supported: typeof fetchImpl === "function",

    async connect() {
      emit({ type: "state", state: "connecting" });
      const candidate = await code();
      const response = await fetchImpl(statusUrl(candidate));
      const body = await readJson(response);
      if (!response.ok) {
        const reason = body.estado?.replace(/^ERR:/, "") ?? `HTTP_${response.status}`;
        emit({ type: "state", state: "error", message: reason });
        throw new Error(reason);
      }
      pairedCode = candidate;
      emit({ type: "state", state: "connected", message: body.robot ?? "" });
    },

    async send(sequence) {
      const robotCode = pairedCode;
      if (robotCode === null) throw new Error("NOT_CONNECTED");
      stopPolling();
      const id = newId();
      const response = await fetchImpl(`${base}/robot/web/enviar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo: robotCode, secuencia: sequence, id }),
      });
      const body = await readJson(response);
      if (!response.ok) {
        const reason = body.estado?.replace(/^ERR:/, "") ?? `HTTP_${response.status}`;
        emit({ type: "failed", reason });
        throw new Error(reason);
      }
      follow(robotCode, id, Date.now(), new Set());
    },

    async disconnect() {
      stopPolling();
      pairedCode = null;
      emit({ type: "state", state: "off" });
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
