import { ConvexError } from "convex/values";
import { generateAccessCode } from "../../domain/evaluation/accessCode";
import { generateJoinCode } from "../../domain/classroom/joinCode";
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

/** Código de clase que ninguna otra clase tiene. */
export async function uniqueJoinCode(ctx: MutationCtx): Promise<string> {
  // 23^3 × 10^3 ≈ 12 millones de combinaciones: alcanza de sobra, pero se verifica.
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = generateJoinCode();
    const taken = await ctx.db
      .query("classrooms")
      .withIndex("by_join_code", (q) => q.eq("joinCode", code))
      .first();
    if (!taken) return code;
  }
  throw new ConvexError("No pudimos generar un código. Intenta de nuevo.");
}
