import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_ARROWS, missionById } from "../domain/lab/mission";
import { solve } from "../domain/lab/solve";
import { api, internal } from "./_generated/api";
import { MAX_PLAYS_PER_MINUTE } from "./lab";
import schema from "./schema";
import { modules } from "./test.setup";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(Date.UTC(2026, 9, 17, 20, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

const DEVICE = "a".repeat(32);
const RUTA = missionById("primaria-tecnologia-materiales")!;
const GOOD = [...solve(RUTA, 1)!.path];
const PROMPT = "Practicar secuencias y rutas con energía.";

async function withTeacher() {
  const t = convexTest(schema, modules);
  const teacherId = await t.run((ctx) => ctx.db.insert("users", { name: "Rosa", email: "rosa@colegio.pe" }));
  const otherId = await t.run((ctx) => ctx.db.insert("users", { name: "Luis", email: "luis@colegio.pe" }));
  return { t, teacher: t.withIdentity({ subject: `${teacherId}|s1` }), other: t.withIdentity({ subject: `${otherId}|s2` }) };
}

describe("laboratorio: el docente crea y publica misiones", () => {
  it("genera, valida y guarda como borrador; al publicar aparece en la vitrina con sus tres niveles", async () => {
    const { t, teacher, other } = await withTeacher();
    const created = await teacher.mutation(api.lab.createMission, { theme: "escuela", prompt: PROMPT, seed: 1 });
    expect(created.minCosts).toEqual([12, 22, 22]);

    // Un borrador solo lo ve su autor; para los demás no existe.
    expect(await t.query(api.lab.listPublic, {})).toEqual([]);
    expect(await t.query(api.lab.get, { id: created.missionId })).toBeNull();
    expect(await other.query(api.lab.get, { id: created.missionId })).toBeNull();
    expect((await teacher.query(api.lab.get, { id: created.missionId }))?.mine).toBe(true);

    await teacher.mutation(api.lab.publish, { missionId: created.missionId });
    const list = await t.query(api.lab.listPublic, {});
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ title: "Ruta de materiales", theme: "escuela", prompt: PROMPT, stations: 2 });
    expect(list[0]!.levels.map((l) => l.budget)).toEqual([30, 33, 27]);

    const got = await t.query(api.lab.get, { id: created.missionId });
    expect(got?.mission.stations).toEqual([[5, 0], [0, 5]]); // semilla impar: estaciones intercambiadas
    expect(got?.mine).toBe(false);
    expect(await t.query(api.lab.get, { id: "no-es-un-id" })).toBeNull();
  });

  it("solo con sesión de docente, con un objetivo escrito y una variante válida", async () => {
    const { t, teacher } = await withTeacher();
    await expect(t.mutation(api.lab.createMission, { theme: "escuela", prompt: PROMPT, seed: 0 })).rejects.toThrow(/Inicia sesión/);
    await expect(teacher.mutation(api.lab.createMission, { theme: "escuela", prompt: "   ", seed: 0 })).rejects.toThrow(/Objetivo/);
    await expect(teacher.mutation(api.lab.createMission, { theme: "escuela", prompt: PROMPT, seed: -1 })).rejects.toThrow(/Variante/);
  });

  it("nadie publica ni ve resultados de la misión de otro docente", async () => {
    const { teacher, other } = await withTeacher();
    const { missionId } = await teacher.mutation(api.lab.createMission, { theme: "biblioteca", prompt: PROMPT, seed: 0 });
    await expect(other.mutation(api.lab.publish, { missionId })).rejects.toThrow(/No encontramos/);
    await expect(other.query(api.lab.results, { missionId })).rejects.toThrow(/No encontramos/);
    expect(await other.query(api.lab.listMine, {})).toEqual([]);
    expect(await teacher.query(api.lab.listMine, {})).toMatchObject([{ title: "Ruta de la biblioteca", visibility: "draft", plays: 0 }]);
  });
});

describe("laboratorio: partidas anónimas que el servidor vuelve a ejecutar", () => {
  const play = (t: ReturnType<typeof convexTest>, arrows: string[], extra: Partial<{ level: number; hints: number; missionId: string }> = {}) =>
    t.mutation(api.lab.recordPlay, { missionId: RUTA.id, level: 1, deviceId: DEVICE, arrows, hints: 0, runs: 1, ms: 20_000, ...extra });

  it("decide el servidor: la ruta verificada completa la misión y una incompleta no", async () => {
    const t = convexTest(schema, modules);
    expect(await play(t, GOOD)).toMatchObject({ ok: true, error: null, energy: 22, stations: 2, steps: GOOD.length });
    expect(await play(t, ["R"])).toMatchObject({ ok: false, error: "No llegó a la meta", energy: 1 });
    expect(await play(t, ["D", "R"])).toMatchObject({ ok: false, error: "El robot chocó con una pared" });
    // Nivel 1 (una estación) con la ruta que no toca ninguna: faltan estaciones.
    expect(await play(t, ["D", "D", "D", "D", "R", "D", "R", "R", "R", "R"], { level: 0 })).toMatchObject({ ok: false, error: "Faltan estaciones obligatorias" });

    const summary = await t.query(api.impact.summary, {});
    expect(summary.total).toMatchObject({ plays: 4, solved: 1, devices: 1 });
    expect(summary.todayStats.plays).toBe(4);
  });

  it("también se juegan las misiones publicadas por docentes, no los borradores", async () => {
    const { t, teacher } = await withTeacher();
    const { missionId } = await teacher.mutation(api.lab.createMission, { theme: "escuela", prompt: PROMPT, seed: 0 });
    await expect(play(t, GOOD, { missionId })).rejects.toThrow(/no está publicada/);
    await teacher.mutation(api.lab.publish, { missionId });
    expect(await play(t, GOOD, { missionId, hints: 2 })).toMatchObject({ ok: true });
    expect(await play(t, ["U"], { missionId, level: 2 })).toMatchObject({ ok: false, error: "Fuera del tablero" });

    const results = await teacher.query(api.lab.results, { missionId });
    expect(results).toMatchObject({ plays: 2, completed: 1, hints: 2 });
    expect(results.levels.map((l) => [l.plays, l.completed])).toEqual([[0, 0], [1, 1], [1, 0]]);
    expect(results.recent[0]).toMatchObject({ levelName: "4.º primaria", budget: 27, ok: false, error: "Fuera del tablero", energy: 0, steps: 1 });
    expect(results.recent[1]).toMatchObject({ levelName: "3.º primaria", ok: true, energy: 22, hints: 2 });
    expect((await teacher.query(api.lab.listMine, {}))[0]?.plays).toBe(2);
  });

  it("rechaza misiones que no existen, niveles fuera de rango, flechas raras y dispositivos con formato raro", async () => {
    const t = convexTest(schema, modules);
    await expect(play(t, GOOD, { missionId: "no-existe" })).rejects.toThrow(/no existe/);
    await expect(play(t, GOOD, { level: 3 })).rejects.toThrow(/nivel/);
    await expect(play(t, ["X"])).rejects.toThrow(/Flecha/);
    await expect(play(t, Array(MAX_ARROWS + 1).fill("R"))).rejects.toThrow(/80/);
    await expect(
      t.mutation(api.lab.recordPlay, { missionId: RUTA.id, level: 0, deviceId: "x", arrows: ["R"], hints: 0 }),
    ).rejects.toThrow(/dispositivo/);
  });

  it("frena a un mismo dispositivo que envía demasiadas partidas seguidas", async () => {
    const t = convexTest(schema, modules);
    for (let i = 0; i < MAX_PLAYS_PER_MINUTE; i++) await play(t, ["R"]);
    await expect(play(t, ["R"])).rejects.toThrow(/muchas/);
    // Sin identificador no se frena, pero igual se anota.
    expect(await t.mutation(api.lab.recordPlay, { missionId: RUTA.id, level: 0, arrows: ["R"], hints: 0 })).toMatchObject({ ok: false });
  });
});

describe("laboratorio: misión semilla", () => {
  it("crea una misión pública una sola vez para que la vitrina no esté vacía", async () => {
    const t = convexTest(schema, modules);
    const first = await t.mutation(internal.lab.seed, {});
    expect(first.created).toBe(true);
    const again = await t.mutation(internal.lab.seed, {});
    expect(again).toEqual({ created: false, missionId: first.missionId });
    const list = await t.query(api.lab.listPublic, {});
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ title: "Ruta de materiales", theme: "escuela" });
    expect(list[0]!.prompt).toMatch(/2\.º, 3\.º y 4\.º/);
  });
});
