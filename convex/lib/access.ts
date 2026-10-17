/**
 * Guardias de acceso. Cada función pública empieza por una de estas: si el
 * llamador no es dueño del recurso, la operación se corta con un error claro.
 */
import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export async function requireTeacher(ctx: QueryCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new ConvexError("Inicia sesión como docente.");
  return userId;
}

export async function requireOwnClassroom(
  ctx: QueryCtx,
  teacherId: Id<"users">,
  classroomId: Id<"classrooms">,
): Promise<Doc<"classrooms">> {
  const classroom = await ctx.db.get(classroomId);
  if (!classroom || classroom.teacherId !== teacherId) {
    throw new ConvexError("No encontramos esa clase.");
  }
  return classroom;
}

export async function requireOwnEvaluation(
  ctx: QueryCtx,
  teacherId: Id<"users">,
  evaluationId: Id<"evaluations">,
): Promise<Doc<"evaluations">> {
  const evaluation = await ctx.db.get(evaluationId);
  if (!evaluation || evaluation.teacherId !== teacherId) {
    throw new ConvexError("No encontramos esa evaluación.");
  }
  return evaluation;
}

export type StudentContext = { student: Doc<"students">; classroom: Doc<"classrooms"> };

/** Valida el token de sesión del alumno (no usa Convex Auth: no tiene cuenta). */
export async function requireStudent(ctx: QueryCtx, token: string): Promise<StudentContext> {
  const session = await ctx.db
    .query("studentSessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
  if (!session || session.expiresAt < Date.now()) {
    throw new ConvexError("Tu sesión terminó. Vuelve a escribir tu código.");
  }
  const student = await ctx.db.get(session.studentId);
  const classroom = student ? await ctx.db.get(student.classroomId) : null;
  if (!student || !classroom) throw new ConvexError("Tu sesión terminó. Vuelve a escribir tu código.");
  return { student, classroom };
}

export const classroomLabel = (c: Pick<Doc<"classrooms">, "level" | "grade" | "section">): string => {
  const level = { inicial: "Inicial", primaria: "Primaria", secundaria: "Secundaria" }[c.level];
  return `${level} · ${c.grade} · Sección ${c.section}`;
};
