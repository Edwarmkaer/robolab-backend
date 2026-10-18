/**
 * Modo abierto: partidas sin cuenta. Solo se guarda un identificador al azar
 * del dispositivo (nunca nombres) para contar cuántas personas usan la app y
 * qué retos resuelven. El servidor vuelve a revisar cada intento.
 */
import { ConvexError, v } from "convex/values";
import { internalQuery, mutation } from "./_generated/server";
import { countPlay } from "./lib/impact";
import { MAX_PLAYS_PER_MINUTE, PLAY_WINDOW_MS, TOO_MANY_PLAYS, blockPlayArgs, verifyBlockPlay } from "./lib/plays";

export { MAX_PLAYS_PER_MINUTE };

const DEVICE_ID = /^[0-9a-f]{32}$/;

export const recordPlay = mutation({
  args: { deviceId: v.string(), ...blockPlayArgs },
  handler: async (ctx, { deviceId, ...input }) => {
    if (!DEVICE_ID.test(deviceId)) throw new ConvexError("Identificador de dispositivo no válido.");
    const { challengeId, play } = verifyBlockPlay(input);

    const now = Date.now();
    const recent = await ctx.db
      .query("explorePlays")
      .withIndex("by_device_time", (q) => q.eq("deviceId", deviceId).gt("createdAt", now - PLAY_WINDOW_MS))
      .collect();
    if (recent.length >= MAX_PLAYS_PER_MINUTE) throw new ConvexError(TOO_MANY_PLAYS);

    await ctx.db.insert("explorePlays", { deviceId, challengeId, ...play, createdAt: now });
    await countPlay(ctx, now, deviceId, play);
    return { solved: play.solved };
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
