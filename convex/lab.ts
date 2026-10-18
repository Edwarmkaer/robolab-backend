/**
 * Laboratorio multigrado: misiones de Primaria (tablero 6×6 con energía).
 *
 * - El docente crea una misión desde un contexto (plantillas locales), el
 *   servidor la genera otra vez, la valida con la búsqueda y la guarda como
 *   borrador; al publicarla aparece en la vitrina `/laboratorio`.
 * - Cualquiera juega sin cuenta: cada "Ejecutar" se anota con `recordPlay`,
 *   que vuelve a ejecutar el programa en el servidor (nunca confía en el
 *   navegador) y suma al panel de impacto. Vale para las misiones del modo
 *   abierto (`MISSIONS`) y para las creadas por docentes.
 * - El panel del docente solo muestra indicadores observables: ejecuciones,
 *   completadas y pistas. No infiere aprendizaje.
 */
import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { execute, parseArrows } from "../domain/lab/execute";
import { generateMission } from "../domain/lab/generate";
import { LabDataError, type Mission, missionById, parseMission } from "../domain/lab/mission";
import { validate } from "../domain/lab/solve";
import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, type QueryCtx, internalMutation, mutation, query } from "./_generated/server";
import { requireTeacher } from "./lib/access";
import { countPlay } from "./lib/impact";
import { cleanText } from "./lib/rules";

export const PROMPT_MAX = 400;
/** Partidas por dispositivo y minuto: una persona jugando de verdad no llega. */
export const MAX_PLAYS_PER_MINUTE = 30;
const DEVICE_ID = /^[0-9a-f]{32}$/;
const RECENT_PLAYS = 200;

const theme = v.union(v.literal("escuela"), v.literal("comunidad"), v.literal("biblioteca"));

const clamp = (n: number, max: number) => Math.min(max, Math.max(0, Math.round(Number.isFinite(n) ? n : 0)));

/** La misión guardada, revisada: si el JSON está dañado se avisa y se omite, en vez de romper la pantalla. */
function readMission(doc: Doc<"labMissions">): Mission | null {
  try {
    return parseMission(doc.mission);
  } catch (error) {
    if (!(error instanceof LabDataError)) throw error;
    console.warn(`La misión ${doc._id} no se puede leer: ${error.message}`);
    return null;
  }
}

async function requireOwnMission(ctx: QueryCtx, teacherId: Id<"users">, missionId: Id<"labMissions">): Promise<Doc<"labMissions">> {
  const doc = await ctx.db.get(missionId);
  if (!doc || doc.teacherId !== teacherId) throw new ConvexError("No encontramos esa misión.");
  return doc;
}

const summary = (doc: Doc<"labMissions">, mission: Mission) => ({
  _id: doc._id,
  title: doc.title,
  theme: doc.theme,
  prompt: doc.prompt,
  visibility: doc.visibility,
  createdAt: doc.createdAt,
  emoji: mission.emoji,
  topic: mission.topic,
  levels: mission.levels,
  stations: mission.stations.length,
});

// ---------- Docente ----------

/** Genera la misión con la semilla que vio el docente, la valida y la guarda como borrador. */
export const createMission = mutation({
  args: { theme, prompt: v.string(), seed: v.number() },
  handler: async (ctx, args) => {
    const teacherId = await requireTeacher(ctx);
    const prompt = cleanText(args.prompt, "Objetivo de clase", 1, PROMPT_MAX);
    if (!Number.isInteger(args.seed) || args.seed < 0) throw new ConvexError("Variante no válida.");
    const mission = generateMission(args.theme, args.seed);
    const check = validate(mission);
    if (!check.ok) throw new ConvexError(check.message);
    const missionId = await ctx.db.insert("labMissions", {
      teacherId,
      title: mission.title,
      theme: args.theme,
      prompt,
      mission,
      visibility: "draft",
      createdAt: Date.now(),
    });
    return { missionId, minCosts: check.solutions.map((s) => s.cost) };
  },
});

export const publish = mutation({
  args: { missionId: v.id("labMissions") },
  handler: async (ctx, { missionId }) => {
    const teacherId = await requireTeacher(ctx);
    const doc = await requireOwnMission(ctx, teacherId, missionId);
    if (doc.visibility !== "public") await ctx.db.patch(doc._id, { visibility: "public" });
    return null;
  },
});

/** Las misiones del docente, con cuántas ejecuciones lleva cada una. */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const teacherId = await requireTeacher(ctx);
    const docs = await ctx.db
      .query("labMissions")
      .withIndex("by_teacher", (q) => q.eq("teacherId", teacherId))
      .order("desc")
      .collect();
    return await Promise.all(
      docs.map(async (doc) => {
        const plays = await ctx.db
          .query("labPlays")
          .withIndex("by_mission_time", (q) => q.eq("missionId", doc._id))
          .collect();
        return { _id: doc._id, title: doc.title, theme: doc.theme, visibility: doc.visibility, createdAt: doc.createdAt, plays: plays.length };
      }),
    );
  },
});

/** Indicadores observables de una misión: nada de porcentajes de aprendizaje. */
export const results = query({
  args: { missionId: v.id("labMissions") },
  handler: async (ctx, { missionId }) => {
    const teacherId = await requireTeacher(ctx);
    const doc = await requireOwnMission(ctx, teacherId, missionId);
    const mission = readMission(doc);
    const plays = await ctx.db
      .query("labPlays")
      .withIndex("by_mission_time", (q) => q.eq("missionId", doc._id))
      .order("desc")
      .collect();
    return {
      title: doc.title,
      prompt: doc.prompt,
      visibility: doc.visibility,
      createdAt: doc.createdAt,
      plays: plays.length,
      completed: plays.filter((p) => p.ok).length,
      hints: plays.reduce((sum, p) => sum + p.hints, 0),
      levels: (mission?.levels ?? []).map((l, i) => ({
        name: l.name,
        budget: l.budget,
        plays: plays.filter((p) => p.level === i).length,
        completed: plays.filter((p) => p.level === i && p.ok).length,
      })),
      recent: plays.slice(0, RECENT_PLAYS).map((p) => ({
        _id: p._id,
        level: p.level,
        levelName: mission?.levels[p.level]?.name ?? `Nivel ${p.level + 1}`,
        budget: mission?.levels[p.level]?.budget ?? null,
        ok: p.ok,
        error: p.error ?? null,
        energy: p.energy,
        steps: p.steps,
        hints: p.hints,
        createdAt: p.createdAt,
      })),
    };
  },
});

// ---------- Público ----------

export const listPublic = query({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db
      .query("labMissions")
      .withIndex("by_visibility", (q) => q.eq("visibility", "public"))
      .order("desc")
      .collect();
    return docs.flatMap((doc) => {
      const mission = readMission(doc);
      return mission ? [summary(doc, mission)] : [];
    });
  },
});

/** Una misión creada por un docente. Un borrador solo lo ve su autor. */
export const get = query({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const missionId = ctx.db.normalizeId("labMissions", id);
    const doc = missionId ? await ctx.db.get(missionId) : null;
    if (!doc) return null;
    const userId = await getAuthUserId(ctx);
    const mine = userId !== null && doc.teacherId === userId;
    if (doc.visibility !== "public" && !mine) return null;
    const mission = readMission(doc);
    return mission ? { ...summary(doc, mission), mission, mine } : null;
  },
});

/** La misión que se juega: una del modo abierto (por su id) o una publicada por un docente. */
async function playableMission(ctx: QueryCtx, id: string): Promise<Mission | null> {
  const fixed = missionById(id);
  if (fixed) return fixed;
  const missionId = ctx.db.normalizeId("labMissions", id);
  const doc = missionId ? await ctx.db.get(missionId) : null;
  if (!doc || doc.visibility !== "public") return null;
  return readMission(doc);
}

/**
 * Cada "Ejecutar" del alumno. El servidor vuelve a ejecutar las flechas y
 * guarda su propio veredicto. `hints` son las pistas pedidas desde la
 * ejecución anterior; `runs` y `ms`, lo acumulado en el nivel (para el impacto).
 */
export const recordPlay = mutation({
  args: {
    missionId: v.string(),
    level: v.number(),
    deviceId: v.optional(v.string()),
    arrows: v.array(v.string()),
    hints: v.number(),
    runs: v.optional(v.number()),
    ms: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.deviceId !== undefined && !DEVICE_ID.test(args.deviceId)) throw new ConvexError("Identificador de dispositivo no válido.");
    const mission = await playableMission(ctx, args.missionId);
    if (!mission) throw new ConvexError("Esa misión no existe o no está publicada.");
    if (!Number.isInteger(args.level) || args.level < 0 || args.level >= mission.levels.length) throw new ConvexError("Ese nivel no existe.");
    let arrows;
    try {
      arrows = parseArrows(args.arrows);
    } catch (error) {
      if (error instanceof LabDataError) throw new ConvexError(error.message);
      throw error;
    }

    const now = Date.now();
    if (args.deviceId) await throttle(ctx, args.deviceId, now);

    const result = execute(mission, args.level, arrows);
    const hints = clamp(args.hints, 100);
    await ctx.db.insert("labPlays", {
      missionId: args.missionId,
      level: args.level,
      ...(args.deviceId ? { deviceId: args.deviceId } : {}),
      ok: result.ok,
      ...(result.error ? { error: result.error } : {}),
      energy: result.cost,
      steps: arrows.length,
      hints,
      createdAt: now,
    });
    await countPlay(ctx, now, args.deviceId ?? "lab:anonimo", {
      solved: result.ok,
      runs: Math.max(1, clamp(args.runs ?? 1, 1000)),
      hints,
      ms: clamp(args.ms ?? 0, 24 * 60 * 60 * 1000),
    });
    return { ok: result.ok, error: result.error, energy: result.cost, stations: result.stations, steps: arrows.length };
  },
});

async function throttle(ctx: MutationCtx, deviceId: string, now: number) {
  const recent = await ctx.db
    .query("labPlays")
    .withIndex("by_device_time", (q) => q.eq("deviceId", deviceId).gt("createdAt", now - 60_000))
    .collect();
  if (recent.length >= MAX_PLAYS_PER_MINUTE) throw new ConvexError("Enviaste muchas partidas seguidas. Espera un momento.");
}

// ---------- Para el equipo (consola) ----------

/**
 * Una misión pública de ejemplo para que la vitrina no esté vacía:
 *   npx convex run lab:seed
 * No hace nada si ya hay alguna misión publicada.
 */
export const seed = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("labMissions")
      .withIndex("by_visibility", (q) => q.eq("visibility", "public"))
      .first();
    if (existing) return { created: false as const, missionId: existing._id };
    const mission = generateMission("escuela", 1);
    const check = validate(mission);
    if (!check.ok) throw new ConvexError(check.message);
    const missionId = await ctx.db.insert("labMissions", {
      title: mission.title,
      theme: "escuela",
      prompt:
        "Quiero una actividad para 2.º, 3.º y 4.º de primaria donde practiquen secuencias, sumas y planificación de rutas, con presupuesto de energía y dos puntos obligatorios.",
      mission,
      visibility: "public",
      createdAt: Date.now(),
    });
    return { created: true as const, missionId };
  },
});
