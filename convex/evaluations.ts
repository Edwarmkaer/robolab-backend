import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { type QueryCtx, mutation, query } from "./_generated/server";
import { classroomLabel, requireOwnClassroom, requireOwnEvaluation, requireTeacher } from "./lib/access";
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
  const finished = attempts.filter((a) => a.finishedAt !== undefined);
  return {
    _id: evaluation._id,
    title: evaluation.title,
    scheduledDate: evaluation.scheduledDate,
    classroomId: evaluation.classroomId,
    classroomLabel: classroom ? classroomLabel(classroom) : "",
    level: classroom?.level ?? "inicial",
    questionCount: questions.length,
    maxScore: questions.reduce((s, q) => s + q.points, 0),
    startedCount: attempts.length,
    finishedCount: finished.length,
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
    const attemptByStudent = new Map(attempts.map((a) => [a.studentId, a]));
    return {
      ...summary,
      questions: questions.map((q) => ({
        _id: q._id,
        prompt: q.prompt,
        options: q.options,
        correctOption: q.correctOption,
        points: q.points,
      })),
      results: students
        .map((s) => {
          const a = attemptByStudent.get(s._id);
          return {
            studentId: s._id,
            displayName: s.displayName,
            status: !a ? ("pending" as const) : a.finishedAt === undefined ? ("in_progress" as const) : ("finished" as const),
            stage: a?.stage ?? 0,
            score: a?.score ?? null,
            percent: a?.percent ?? null,
            totalMs: a?.totalMs ?? null,
          };
        })
        .sort((x, y) => x.displayName.localeCompare(y.displayName, "es")),
    };
  },
});
