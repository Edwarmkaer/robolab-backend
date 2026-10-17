/**
 * Datos para el gráfico de desarrollo del aprendizaje: el porcentaje de cada
 * alumno en cada evaluación de la clase, en orden de fecha, y el promedio.
 */
import { v } from "convex/values";
import { query } from "./_generated/server";
import { classroomLabel, requireOwnClassroom, requireTeacher } from "./lib/access";

export const classProgress = query({
  args: { classroomId: v.id("classrooms") },
  handler: async (ctx, { classroomId }) => {
    const teacherId = await requireTeacher(ctx);
    const classroom = await requireOwnClassroom(ctx, teacherId, classroomId);
    const evaluations = await ctx.db
      .query("evaluations")
      .withIndex("by_classroom_date", (q) => q.eq("classroomId", classroomId))
      .collect();
    const students = await ctx.db
      .query("students")
      .withIndex("by_classroom", (q) => q.eq("classroomId", classroomId))
      .collect();

    const points = await Promise.all(
      evaluations.map(async (e) => {
        const attempts = await ctx.db
          .query("attempts")
          .withIndex("by_evaluation", (q) => q.eq("evaluationId", e._id))
          .collect();
        const finished = attempts.filter((a) => a.finishedAt !== undefined && a.percent !== undefined);
        const byStudent = new Map(finished.map((a) => [a.studentId, a]));
        const average =
          finished.length === 0
            ? null
            : Math.round(finished.reduce((s, a) => s + (a.percent ?? 0), 0) / finished.length);
        return {
          evaluationId: e._id,
          title: e.title,
          date: e.scheduledDate,
          average,
          finishedCount: finished.length,
          byStudent,
        };
      }),
    );

    return {
      classroomLabel: classroomLabel(classroom),
      evaluations: points.map(({ byStudent: _omit, ...p }) => p),
      students: students
        .map((s) => ({
          studentId: s._id,
          displayName: s.displayName,
          series: points.map((p) => {
            const a = p.byStudent.get(s._id);
            return { evaluationId: p.evaluationId, percent: a?.percent ?? null, totalMs: a?.totalMs ?? null };
          }),
        }))
        .sort((a, b) => a.displayName.localeCompare(b.displayName, "es")),
    };
  },
});
