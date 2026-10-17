/**
 * Registro de correos salientes. Antes de enviar se reserva el envío (y se
 * frena si se piden demasiados); después se anota si salió o no.
 */
import { ConvexError, v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { HOUR_MS, checkSendAllowed } from "./lib/mailPolicy";

const kind = v.literal("password-reset");

export const reserve = internalMutation({
  args: { to: v.string(), kind },
  handler: async (ctx, { to, kind }) => {
    const now = Date.now();
    const recent = await ctx.db
      .query("emailDeliveries")
      .withIndex("by_to_requested", (q) => q.eq("to", to).gt("requestedAt", now - HOUR_MS))
      .collect();
    const decision = checkSendAllowed(
      recent.filter((d) => d.kind === kind && d.status !== "failed").map((d) => d.requestedAt),
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
