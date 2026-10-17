import { ConvexError } from "convex/values";
import { generateAccessCode } from "../../src/domain/evaluation/accessCode";
import type { MutationCtx } from "../_generated/server";

/** Código de acceso que ningún otro alumno tiene. */
export async function uniqueAccessCode(ctx: MutationCtx): Promise<string> {
  // 31^6 ≈ 887 millones de combinaciones: una colisión es rarísima, pero se verifica.
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateAccessCode();
    const taken = await ctx.db
      .query("students")
      .withIndex("by_access_code", (q) => q.eq("accessCode", code))
      .first();
    if (!taken) return code;
  }
  throw new ConvexError("No pudimos generar un código. Intenta de nuevo.");
}
