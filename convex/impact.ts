/**
 * Panel público de impacto: cuánto se usa RoboLab y cómo le va a quien juega.
 * Solo cifras; nunca nombres ni identificadores.
 */
import { TOTAL, limaDay, summarize } from "../domain/impact/summary";
import { internalMutation, query } from "./_generated/server";
import { countFinishedAttempt, countPlay, dayRow } from "./lib/impact";

export const summary = query({
  args: {},
  handler: async (ctx) => {
    const today = limaDay(Date.now());
    const [total, day] = await Promise.all([dayRow(ctx, TOTAL), dayRow(ctx, today)]);
    return summarize(total, day, today);
  },
});

/**
 * Vuelve a calcular las cuentas desde las partidas y los intentos guardados
 * (para estrenar el panel con lo que ya existía, o si alguna cuenta se desvía):
 *   npx convex run impact:rebuild
 */
export const rebuild = internalMutation({
  args: {},
  handler: async (ctx) => {
    for (const row of await ctx.db.query("impactDays").collect()) await ctx.db.delete(row._id);
    for (const row of await ctx.db.query("impactSeen").collect()) await ctx.db.delete(row._id);

    const plays = await ctx.db.query("explorePlays").collect();
    plays.sort((a, b) => a.createdAt - b.createdAt);
    for (const p of plays) await countPlay(ctx, p.createdAt, p.deviceId, p);

    // Las partidas de alumnos con sesión se cuentan por su id, no por nombre, como al jugarlas.
    const classPlays = await ctx.db.query("challengePlays").collect();
    classPlays.sort((a, b) => a.createdAt - b.createdAt);
    for (const p of classPlays) await countPlay(ctx, p.createdAt, `alumno:${p.studentId}`, p);

    const finished = (await ctx.db.query("attempts").collect()).filter((a) => a.finishedAt !== undefined);
    finished.sort((a, b) => a.finishedAt! - b.finishedAt!);
    for (const a of finished) await countFinishedAttempt(ctx, a.finishedAt!, a.studentId);

    return summarize(await dayRow(ctx, TOTAL), null, limaDay(Date.now())).total;
  },
});
