/**
 * Lo que cuelga de una clase y se consulta desde varios sitios: sus alumnos,
 * los retos asignados y las partidas verificadas de esos alumnos.
 */
import type { PlayRow } from "../../domain/classroom/challengeStats";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export async function studentsOf(ctx: QueryCtx, classroomId: Id<"classrooms">): Promise<Doc<"students">[]> {
  return await ctx.db
    .query("students")
    .withIndex("by_classroom", (q) => q.eq("classroomId", classroomId))
    .collect();
}

/** Todos los retos de la clase, del más antiguo al más nuevo (incluye borradores). */
export async function assignmentsOf(ctx: QueryCtx, classroomId: Id<"classrooms">): Promise<Doc<"assignments">[]> {
  const all = await ctx.db
    .query("assignments")
    .withIndex("by_classroom", (q) => q.eq("classroomId", classroomId))
    .collect();
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

/** Los retos que los alumnos ya ven: todos menos los borradores y los que el docente cerró. */
export async function visibleAssignments(ctx: QueryCtx, classroomId: Id<"classrooms">): Promise<Doc<"assignments">[]> {
  return (await assignmentsOf(ctx, classroomId)).filter((a) => a.visibility !== "draft" && a.closedAt === undefined);
}

/** Todas las partidas de la clase, en el formato del dominio. */
export async function classPlays(ctx: QueryCtx, classroomId: Id<"classrooms">): Promise<PlayRow[]> {
  return await ctx.db
    .query("challengePlays")
    .withIndex("by_classroom_challenge", (q) => q.eq("classroomId", classroomId))
    .collect();
}
