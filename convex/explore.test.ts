import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { move, repeat } from "../src/domain/game/program";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

const DEVICE = "a".repeat(32);
const F = move("FORWARD");

describe("modo abierto: partidas anónimas", () => {
  it("el servidor verifica si el reto se resolvió, sin creerle al navegador", async () => {
    const t = convexTest(schema, modules);
    const base = { deviceId: DEVICE, runs: 2, hints: 1, ms: 40_000 };
    expect(await t.mutation(api.explore.recordPlay, { ...base, challengeId: "inicial-paseo", program: [F, F, F] })).toEqual({
      solved: true,
    });
    expect(await t.mutation(api.explore.recordPlay, { ...base, challengeId: "inicial-paseo", program: [F] })).toEqual({
      solved: false,
    });
    expect(
      await t.mutation(api.explore.recordPlay, { ...base, challengeId: "primaria-donde", pick: { row: 1, col: 2 } }),
    ).toEqual({ solved: true });
    // Un programa mal formado cuenta como no resuelto, no rompe nada.
    expect(
      await t.mutation(api.explore.recordPlay, { ...base, challengeId: "primaria-menos", program: [{ kind: "x" }] }),
    ).toEqual({ solved: false });

    const stats = await t.query(internal.explore.stats, {});
    expect(stats).toMatchObject({ plays: 4, solved: 2, devices: 1 });
    expect(stats.byChallenge["inicial-paseo"]).toEqual({ plays: 2, solved: 1 });
  });

  it("rechaza retos inexistentes y dispositivos con formato raro", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.explore.recordPlay, { deviceId: DEVICE, challengeId: "no-existe", program: [], runs: 1, hints: 0, ms: 1 }),
    ).rejects.toThrow(/reto/);
    await expect(
      t.mutation(api.explore.recordPlay, { deviceId: "x", challengeId: "inicial-paseo", program: [], runs: 1, hints: 0, ms: 1 }),
    ).rejects.toThrow(/dispositivo/);
  });

  it("frena a un mismo dispositivo que envía demasiadas partidas seguidas", async () => {
    const t = convexTest(schema, modules);
    const play = { deviceId: DEVICE, challengeId: "primaria-paradas", program: [repeat(4, [F])], runs: 1, hints: 0, ms: 1 };
    for (let i = 0; i < 30; i++) await t.mutation(api.explore.recordPlay, play);
    await expect(t.mutation(api.explore.recordPlay, play)).rejects.toThrow(/muchas/);
  });
});
