import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { type QueryCtx, mutation, query } from "./_generated/server";
import { rankStudents } from "../src/domain/evaluation/ranking";
import { classroomLabel, requireOwnClassroom, requireOwnEvaluation, requireTeacher } from "./lib/access";
import { attemptNumber, finishedAttempts, groupByStudent } from "./lib/attempts";
import { LIMITS, cleanQuestions, cleanText, requireCalendarDate } from "./lib/rules";

const questionInput = v.object({
  prompt: v.string(),
  options: v.array(v.string()),
  correctOption: v.number(),
  points: v.number(),
});

export const create = mutation({
  args: {
    classroomId: v.id("classrooms"),
    title: v.string(),
    scheduledDate: v.string(),
    questions: v.array(questionInput),
  },
  handler: async (ctx, args): Promise<Id<"evaluations">> => {
    const teacherId = await requireTeacher(ctx);
    await requireOwnClassroom(ctx, teacherId, args.classroomId);
    const title = cleanText(args.title, "Título", LIMITS.titleMin, LIMITS.titleMax);
    const scheduledDate = requireCalendarDate(args.scheduledDate);
    const questions = cleanQuestions(args.questions);

    const evaluationId = await ctx.db.insert("evaluations", {
      teacherId,
      classroomId: args.classroomId,
      title,
      scheduledDate,
      createdAt: Date.now(),
    });
    for (const [order, q] of questions.entries()) {
      await ctx.db.insert("questions", { evaluationId, order, ...q });
    }
    return evaluationId;
  },
});

async function summarize(ctx: QueryCtx, evaluation: Doc<"evaluations">) {
  const classroom = await ctx.db.get(evaluation.classroomId);
  const questions = await ctx.db
    .query("questions")
    .withIndex("by_evaluation_order", (q) => q.eq("evaluationId", evaluation._id))
    .collect();
  const attempts = await ctx.db
    .query("attempts")
    .withIndex("by_evaluation", (q) => q.eq("evaluationId", evaluation._id))
    .collect();
  // Se cuentan alumnos, no intentos: quien la rinde dos veces sigue siendo una persona.
  const byStudent = groupByStudent(attempts);
  const finishedStudents = [...byStudent.values()].filter((list) => list.some((a) => a.finishedAt !== undefined));
  const playing = [...byStudent.values()].filter((list) => list.at(-1)?.finishedAt === undefined);
  const students = await ctx.db
    .query("students")
    .withIndex("by_classroom", (q) => q.eq("classroomId", evaluation.classroomId))
    .collect();
  return {
    _id: evaluation._id,
    title: evaluation.title,
    scheduledDate: evaluation.scheduledDate,
    classroomId: evaluation.classroomId,
    classroomLabel: classroom ? classroomLabel(classroom) : "",
    level: classroom?.level ?? "inicial",
    questionCount: questions.length,
    maxScore: questions.reduce((s, q) => s + q.points, 0),
    studentCount: students.length,
    startedCount: byStudent.size,
    finishedCount: finishedStudents.length,
    playingCount: playing.length,
  };
}

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const teacherId = await requireTeacher(ctx);
    const evaluations = await ctx.db
      .query("evaluations")
      .withIndex("by_teacher_date", (q) => q.eq("teacherId", teacherId))
      .order("desc")
      .collect();
    return await Promise.all(evaluations.map((e) => summarize(ctx, e)));
  },
});

export const listForDate = query({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    const teacherId = await requireTeacher(ctx);
    const evaluations = await ctx.db
      .query("evaluations")
      .withIndex("by_teacher_date", (q) => q.eq("teacherId", teacherId).eq("scheduledDate", date))
      .collect();
    return await Promise.all(evaluations.map((e) => summarize(ctx, e)));
  },
});

export const get = query({
  args: { evaluationId: v.id("evaluations") },
  handler: async (ctx, { evaluationId }) => {
    const teacherId = await requireTeacher(ctx);
    const evaluation = await requireOwnEvaluation(ctx, teacherId, evaluationId);
    const summary = await summarize(ctx, evaluation);
    const questions = await ctx.db
      .query("questions")
      .withIndex("by_evaluation_order", (q) => q.eq("evaluationId", evaluationId))
      .collect();
    const students = await ctx.db
      .query("students")
      .withIndex("by_classroom", (q) => q.eq("classroomId", evaluation.classroomId))
      .collect();
    const attempts = await ctx.db
      .query("attempts")
      .withIndex("by_evaluation", (q) => q.eq("evaluationId", evaluationId))
      .collect();
    const byStudent = groupByStudent(attempts);

    const ranked = rankStudents(
      await Promise.all(
        students.map(async (s) => ({ studentId: s._id, attempts: await finishedAttempts(ctx, byStudent.get(s._id) ?? []) })),
      ),
    );
    const rankOf = new Map(ranked.map((r) => [r.studentId, r]));

    const results = students.map((s) => {
      const list = byStudent.get(s._id) ?? [];
      const latest = list.at(-1);
      const rank = rankOf.get(s._id);
      const playing = latest !== undefined && latest.finishedAt === undefined;
      const status = !latest
        ? ("pending" as const)
        : playing
          ? rank
            ? ("retrying" as const)
            : ("in_progress" as const)
          : ("finished" as const);
      return {
        studentId: s._id,
        displayName: s.displayName,
        status,
        /** Etapa del intento en curso (o del último). */
        stage: latest?.stage ?? 0,
        attemptNumber: latest ? attemptNumber(latest) : 0,
        position: rank?.position ?? null,
        score: rank?.attempt.score ?? null,
        percent: rank?.attempt.percent ?? null,
        totalMs: rank?.attempt.totalMs ?? null,
        runs: rank?.attempt.runs ?? null,
        tries: rank?.tries ?? null,
        totalTries: rank?.totalTries ?? 0,
      };
    });
    // Primero el ranking; después quienes están jugando y al final quienes no empiezan.
    const order = { finished: 0, retrying: 0, in_progress: 1, pending: 2 } as const;
    results.sort(
      (a, b) =>
        order[a.status] - order[b.status] ||
        (a.position ?? Infinity) - (b.position ?? Infinity) ||
        a.displayName.localeCompare(b.displayName, "es"),
    );

    return {
      ...summary,
      questions: questions.map((q) => ({
        _id: q._id,
        prompt: q.prompt,
        options: q.options,
        correctOption: q.correctOption,
        points: q.points,
      })),
      results,
    };
  },
});
