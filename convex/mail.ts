/**
 * Registro de correos salientes. Antes de enviar se reserva el envío (y se
 * frena si se piden demasiados); después se anota si salió o no.
 */
import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./_generated/server";
import { HOUR_MS, checkSendAllowed } from "./lib/mailPolicy";

const kind = v.literal("password-reset");

/** Un envío que sigue "pendiente" después de esto se da por perdido (la acción murió a mitad): no frena los siguientes. */
export const PENDING_STALE_MS = 5 * 60_000;

const countsForPolicy = (d: Doc<"emailDeliveries">, now: number) =>
  d.status === "sent" || (d.status === "pending" && now - d.requestedAt < PENDING_STALE_MS);

export const reserve = internalMutation({
  args: { to: v.string(), kind },
  handler: async (ctx, { to, kind }) => {
    const now = Date.now();
    const recent = await ctx.db
      .query("emailDeliveries")
      .withIndex("by_to_requested", (q) => q.eq("to", to).gt("requestedAt", now - HOUR_MS))
      .collect();
    const decision = checkSendAllowed(
      recent.filter((d) => d.kind === kind && countsForPolicy(d, now)).map((d) => d.requestedAt),
      now,
    );
    if (!decision.ok) {
      const seconds = Math.ceil(decision.retryInMs / 1000);
      throw new ConvexError(
        seconds <= 90
          ? `Ya te enviamos un código hace poco. Puedes pedir otro en ${seconds} segundos.`
          : `Pediste varios códigos seguidos. Intenta de nuevo en ${Math.ceil(seconds / 60)} minutos.`,
      );
    }
    return await ctx.db.insert("emailDeliveries", { to, kind, status: "pending", requestedAt: now });
  },
});

/** El envío que `passwordReset.request` reservó hace un momento para este correo, si lo hay. */
export const claimPending = internalQuery({
  args: { to: v.string(), kind },
  handler: async (ctx, { to, kind }) => {
    const now = Date.now();
    const recent = await ctx.db
      .query("emailDeliveries")
      .withIndex("by_to_requested", (q) => q.eq("to", to).gt("requestedAt", now - PENDING_STALE_MS))
      .collect();
    return recent.filter((d) => d.kind === kind && d.status === "pending").at(-1)?._id ?? null;
  },
});

export const settle = internalMutation({
  args: {
    deliveryId: v.id("emailDeliveries"),
    status: v.union(v.literal("sent"), v.literal("failed")),
    provider: v.optional(v.string()),
    providerMessageId: v.optional(v.string()),
  },
  handler: async (ctx, { deliveryId, ...result }) => {
    await ctx.db.patch(deliveryId, { ...result, settledAt: Date.now() });
  },
});
