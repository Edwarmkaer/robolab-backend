import { describe, expect, it } from "vitest";
import { SLOW_REQUEST_MS, connectionNotice } from "./connection";

const NOW = 1_000_000;
const base = {
  isWebSocketConnected: true,
  hasEverConnected: true,
  connectionRetries: 0,
  timeOfOldestInflightRequest: null,
};

describe("aviso de conexión", () => {
  it("no molesta mientras todo va bien o mientras se conecta por primera vez", () => {
    expect(connectionNotice(base, NOW)).toBeNull();
    expect(connectionNotice({ ...base, isWebSocketConnected: false, hasEverConnected: false }, NOW)).toBeNull();
  });

  it("si nunca logró conectar, lo dice en vez de dejar la pantalla colgada", () => {
    const notice = connectionNotice({ ...base, isWebSocketConnected: false, hasEverConnected: false, connectionRetries: 1 }, NOW);
    expect(notice?.kind).toBe("unreachable");
    expect(notice?.message).toMatch(/No podemos conectar/);
  });

  it("si se cae la conexión, avisa que está reintentando", () => {
    const notice = connectionNotice({ ...base, isWebSocketConnected: false }, NOW);
    expect(notice?.kind).toBe("lost");
    expect(notice?.message).toMatch(/Se perdió la conexión/);
  });

  it("si un pedido tarda demasiado, avisa que el servidor está lento", () => {
    const fresh = new Date(NOW - SLOW_REQUEST_MS + 1000);
    const stale = new Date(NOW - SLOW_REQUEST_MS - 1);
    expect(connectionNotice({ ...base, timeOfOldestInflightRequest: fresh }, NOW)).toBeNull();
    expect(connectionNotice({ ...base, timeOfOldestInflightRequest: stale }, NOW)?.kind).toBe("slow");
  });
});
