import { describe, expect, it, vi } from "vitest";
import { type RobotEvent, createWifiLink } from "./wifiLink";

/** Un relé falso: responde como las rutas /robot/web/* y avanza el estado en cada consulta. */
function fakeRelay(options: { busy?: boolean; states?: string[]; badCode?: boolean } = {}) {
  const states = [...(options.states ?? ["ENTREGADO", "OK", "RUN", "DONE"])];
  const calls: { url: string; body?: unknown }[] = [];
  const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, body });
    if (options.badCode) return new Response(JSON.stringify({ estado: "ERR:NO_ROBOT" }), { status: 404 });
    if (url.includes("/robot/web/enviar")) {
      return options.busy
        ? new Response(JSON.stringify({ estado: "ERR:BUSY" }), { status: 409 })
        : new Response(JSON.stringify({ estado: "EN_COLA", id: body.id }), { status: 200 });
    }
    const estado = url.includes("id=") ? (states.shift() ?? "DONE") : null;
    return new Response(JSON.stringify({ estado, conectado: true, robot: "Kusi" }), { status: 200 });
  });
  return { fetchImpl, calls };
}

const collect = (link: ReturnType<typeof createWifiLink>) => {
  const events: RobotEvent[] = [];
  link.subscribe((e) => events.push(e));
  return events;
};

describe("adaptador WiFi (RobotLink del contrato)", () => {
  it("se conecta con el código y envía; resuelve al enviar y avisa received, running y done", async () => {
    const relay = fakeRelay();
    const link = createWifiLink({ baseUrl: "https://relay.test", code: () => "sr965h", fetchImpl: relay.fetchImpl, pollMs: 1 });
    const events = collect(link);
    expect(link.transport).toBe("wifi");

    await link.connect();
    expect(events).toContainEqual({ type: "state", state: "connected", message: "Kusi" });

    await link.send("AADZAA");
    expect(relay.calls.find((c) => c.url.includes("enviar"))?.body).toMatchObject({ codigo: "SR965H", secuencia: "AADZAA" });
    await vi.waitFor(() => expect(events).toContainEqual({ type: "done" }));
    const types = events.map((e) => (e.type === "state" ? `state:${e.state}` : e.type));
    expect(types).toEqual(["state:connecting", "state:connected", "received", "state:running", "done", "state:connected"]);
  });

  it("si el robot está ocupado, el envío falla con BUSY", async () => {
    const relay = fakeRelay({ busy: true });
    const link = createWifiLink({ baseUrl: "https://relay.test", code: () => "SR965H", fetchImpl: relay.fetchImpl, pollMs: 1 });
    const events = collect(link);
    await link.connect();
    await expect(link.send("A")).rejects.toThrow("BUSY");
    expect(events).toContainEqual({ type: "failed", reason: "BUSY" });
  });

  it("valida la secuencia antes de mandarla y avisa errores del robot", async () => {
    const relay = fakeRelay({ states: ["OK", "ERR:MOTOR"] });
    const link = createWifiLink({ baseUrl: "https://relay.test", code: () => "SR965H", fetchImpl: relay.fetchImpl, pollMs: 1 });
    const events = collect(link);
    await link.connect();
    await expect(link.send("AXA")).rejects.toThrow("BAD_CHAR");
    await link.send("AA");
    await vi.waitFor(() => expect(events).toContainEqual({ type: "failed", reason: "MOTOR" }));
  });

  it("un código que no existe deja el enlace en error", async () => {
    const link = createWifiLink({ baseUrl: "https://relay.test", code: () => "ZZZZZZ", fetchImpl: fakeRelay({ badCode: true }).fetchImpl });
    const events = collect(link);
    await expect(link.connect()).rejects.toThrow("NO_ROBOT");
    expect(events.at(-1)).toMatchObject({ type: "state", state: "error" });
  });
});
