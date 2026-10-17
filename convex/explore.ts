/**
 * Modo abierto: partidas sin cuenta. Solo se guarda un identificador al azar
 * del dispositivo (nunca nombres) para contar cuántas personas usan la app y
 * qué retos resuelven. El servidor vuelve a revisar cada intento.
 */
import { ConvexError, v } from "convex/values";
import { challengeById } from "../src/domain/explore/challenges";
import { checkPrediction, checkProgram } from "../src/domain/explore/check";
import { ProgramError, parseProgram } from "../src/domain/game/program";
import { internalQuery, mutation } from "./_generated/server";

const DEVICE_ID = /^[0-9a-f]{32}$/;
/** Partidas por dispositivo y minuto: una persona jugando de verdad no llega. */
export const MAX_PLAYS_PER_MINUTE = 30;

const clamp = (n: number, max: number) => Math.min(max, Math.max(0, Math.round(Number.isFinite(n) ? n : 0)));

export const recordPlay = mutation({
  args: {
    deviceId: v.string(),
    challengeId: v.string(),
    program: v.optional(v.any()),
    pick: v.optional(v.object({ row: v.number(), col: v.number() })),
    runs: v.number(),
    hints: v.number(),
    ms: v.number(),
  },
  handler: async (ctx, args) => {
    if (!DEVICE_ID.test(args.deviceId)) throw new ConvexError("Identificador de dispositivo no válido.");
    const challenge = challengeById(args.challengeId);
    if (!challenge) throw new ConvexError("Ese reto no existe.");

    const now = Date.now();
    const recent = await ctx.db
      .query("explorePlays")
      .withIndex("by_device_time", (q) => q.eq("deviceId", args.deviceId).gt("createdAt", now - 60_000))
      .collect();
    if (recent.length >= MAX_PLAYS_PER_MINUTE) throw new ConvexError("Enviaste muchas partidas seguidas. Espera un momento.");

    let solved = false;
    if (challenge.kind === "predict") {
      solved = args.pick !== undefined && checkPrediction(challenge, args.pick).ok;
    } else {
      try {
        solved = checkProgram(challenge, parseProgram(args.program)).result.ok;
      } catch (error) {
        if (!(error instanceof ProgramError)) throw error;
      }
    }

    await ctx.db.insert("explorePlays", {
      deviceId: args.deviceId,
      challengeId: challenge.id,
      solved,
      runs: clamp(args.runs, 1000),
      hints: clamp(args.hints, challenge.hints.length),
      ms: clamp(args.ms, 24 * 60 * 60 * 1000),
      createdAt: now,
    });
    return { solved };
  },
});

/**
 * Cifras de uso para el equipo (no es pública):
 *   npx convex run explore:stats
 */
export const stats = internalQuery({
  args: {},
  handler: async (ctx) => {
    const plays = await ctx.db.query("explorePlays").collect();
    const byChallenge: Record<string, { plays: number; solved: number }> = {};
    for (const p of plays) {
      const entry = (byChallenge[p.challengeId] ??= { plays: 0, solved: 0 });
      entry.plays++;
      if (p.solved) entry.solved++;
    }
    return {
      plays: plays.length,
      solved: plays.filter((p) => p.solved).length,
      devices: new Set(plays.map((p) => p.deviceId)).size,
      byChallenge,
    };
  },
});
