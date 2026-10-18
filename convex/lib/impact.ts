/**
 * Mantiene las cuentas del panel de impacto al día: cada partida del modo
 * abierto y cada evaluación terminada suman a la fila del día (hora de Perú)
 * y a la fila "total". Quién ya se contó se recuerda por una clave opaca
 * (id al azar del dispositivo o id del alumno), nunca por nombre.
 */
import { type DayStats, type PlayFacts, TOTAL, addFinishedAttempt, addPlay, emptyDay, limaDay } from "../../domain/impact/summary";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export async function dayRow(ctx: QueryCtx, day: string): Promise<DayStats | null> {
  const row = await ctx.db
    .query("impactDays")
    .withIndex("by_day", (q) => q.eq("day", day))
    .unique();
  return row ? stats(row) : null;
}

function stats(row: Doc<"impactDays">): DayStats {
  return {
    day: row.day,
    plays: row.plays,
    solved: row.solved,
    withHints: row.withHints,
    withHintsSolved: row.withHintsSolved,
    runsSolved: row.runsSolved,
    msSolved: row.msSolved,
    devices: row.devices,
    attemptsFinished: row.attemptsFinished,
    students: row.students,
  };
}

/** Devuelve true la primera vez que se ve la clave en ese día. */
async function firstTime(ctx: MutationCtx, day: string, key: string): Promise<boolean> {
  const seen = await ctx.db
    .query("impactSeen")
    .withIndex("by_day_key", (q) => q.eq("day", day).eq("key", key))
    .unique();
  if (seen) return false;
  await ctx.db.insert("impactSeen", { day, key });
  return true;
}

async function update(ctx: MutationCtx, day: string, change: (current: DayStats) => DayStats) {
  const row = await ctx.db
    .query("impactDays")
    .withIndex("by_day", (q) => q.eq("day", day))
    .unique();
  const next = change(row ? stats(row) : emptyDay(day));
  if (row) await ctx.db.patch(row._id, next);
  else await ctx.db.insert("impactDays", next);
}

export async function countPlay(ctx: MutationCtx, at: number, deviceId: string, play: PlayFacts) {
  for (const day of [limaDay(at), TOTAL]) {
    const newDevice = await firstTime(ctx, day, `d:${deviceId}`);
    await update(ctx, day, (current) => addPlay(current, play, newDevice));
  }
}

export async function countFinishedAttempt(ctx: MutationCtx, at: number, studentId: Id<"students">) {
  for (const day of [limaDay(at), TOTAL]) {
    const newStudent = await firstTime(ctx, day, `a:${studentId}`);
    await update(ctx, day, (current) => addFinishedAttempt(current, newStudent));
  }
}
