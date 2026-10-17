/**
 * Robot físico por wifi. La app no le habla directo al robot (una página
 * HTTPS no puede llamar a un aparato de la red local por HTTP): deja el
 * programa aquí y el ESP32 pregunta cada medio segundo si hay algo para él.
 *
 *   App ──send(código, bloques)──▶ Convex ◀──GET /robot/siguiente── ESP32
 *
 * Registrar un robot (una vez, desde la consola del equipo):
 *   npx convex run robot:register '{"name":"Kusi"}'
 * Devuelve el código (va en una etiqueta del robot) y la clave (va en el firmware).
 */
import { ConvexError, v } from "convex/values";
import { generateAccessCode, generateSessionToken } from "../src/domain/evaluation/accessCode";
import { ProgramError } from "../src/domain/game/program";
import { isValidRobotCode, normalizeRobotCode, toRobotText } from "../src/domain/robot/protocol";
import type { Doc } from "./_generated/dataModel";
import { type QueryCtx, internalMutation, mutation, query } from "./_generated/server";

/** Cada cuánto se anota que el robot sigue conectado (evita escribir en cada consulta). */
const SEEN_EVERY_MS = 3_000;

export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function robotByCode(ctx: QueryCtx, raw: string): Promise<Doc<"robots"> | null> {
  const code = normalizeRobotCode(raw);
  if (!isValidRobotCode(code)) return null;
  return await ctx.db
    .query("robots")
    .withIndex("by_code", (q) => q.eq("code", code))
    .unique();
}

async function latestCommand(ctx: QueryCtx, robot: Doc<"robots">) {
  return await ctx.db
    .query("robotCommands")
    .withIndex("by_robot", (q) => q.eq("robotId", robot._id))
    .order("desc")
    .first();
}

export const register = internalMutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    let code = generateAccessCode();
    while (await robotByCode(ctx, code)) code = generateAccessCode();
    const key = generateSessionToken().slice(0, 32);
    await ctx.db.insert("robots", { name: name.trim() || "Robot", code, keyHash: await sha256(key), createdAt: Date.now() });
    return { code, key };
  },
});

/** La app envía un programa. Si había otro esperando, se reemplaza: el robot hace el último. */
export const send = mutation({
  args: { code: v.string(), program: v.any() },
  handler: async (ctx, { code, program }) => {
    const robot = await robotByCode(ctx, code);
    if (!robot) throw new ConvexError("No encontramos ese robot. Revisa el código de su etiqueta.");
    let letters: string;
    try {
      letters = toRobotText(program);
    } catch (error) {
      if (error instanceof ProgramError) throw new ConvexError(error.message);
      throw error;
    }
    const pending = await ctx.db
      .query("robotCommands")
      .withIndex("by_robot_status", (q) => q.eq("robotId", robot._id).eq("status", "pending"))
      .collect();
    for (const old of pending) await ctx.db.patch(old._id, { status: "replaced" });
    await ctx.db.insert("robotCommands", { robotId: robot._id, letters, status: "pending", createdAt: Date.now() });
    return { letters, robotName: robot.name };
  },
});

/** Estado para la app: nombre, última vez que se conectó y qué pasó con el último programa. */
export const status = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const robot = await robotByCode(ctx, code);
    if (!robot) return null;
    const last = await latestCommand(ctx, robot);
    return {
      name: robot.name,
      lastSeenAt: robot.lastSeenAt ?? null,
      lastCommand: last ? { letters: last.letters, status: last.status, createdAt: last.createdAt } : null,
    };
  },
});

async function authenticate(ctx: QueryCtx, code: string, key: string) {
  const robot = await robotByCode(ctx, code);
  if (!robot || !/^[0-9a-f]{32}$/.test(key) || (await sha256(key)) !== robot.keyHash) return null;
  return robot;
}

/** El robot pide su siguiente programa (lo usa la ruta HTTP). */
export const takeNext = internalMutation({
  args: { code: v.string(), key: v.string() },
  handler: async (ctx, { code, key }) => {
    const robot = await authenticate(ctx, code, key);
    if (!robot) return { ok: false as const };
    const now = Date.now();
    if (!robot.lastSeenAt || now - robot.lastSeenAt > SEEN_EVERY_MS) await ctx.db.patch(robot._id, { lastSeenAt: now });
    const next = await ctx.db
      .query("robotCommands")
      .withIndex("by_robot_status", (q) => q.eq("robotId", robot._id).eq("status", "pending"))
      .first();
    if (!next) return { ok: true as const, letters: null };
    await ctx.db.patch(next._id, { status: "sent", sentAt: now });
    return { ok: true as const, letters: next.letters };
  },
});

/** El robot avisa que terminó el último programa. */
export const markDone = internalMutation({
  args: { code: v.string(), key: v.string() },
  handler: async (ctx, { code, key }) => {
    const robot = await authenticate(ctx, code, key);
    if (!robot) return { ok: false as const };
    const last = await latestCommand(ctx, robot);
    if (last?.status === "sent") await ctx.db.patch(last._id, { status: "done", doneAt: Date.now() });
    return { ok: true as const };
  },
});
