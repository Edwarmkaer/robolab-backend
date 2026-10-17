/**
 * Portal del alumno: entra con su código, juega y responde.
 *
 * El servidor es la autoridad del intento: vuelve a simular el programa del
 * alumno para confirmar que llegó a la estrella, recién entonces revela la
 * pregunta (sin la respuesta correcta) y calcula la nota con sus propios
 * tiempos.
 */
import { ConvexError, v } from "convex/values";
import {
  generateSessionToken,
  isValidAccessCode,
  normalizeAccessCode,
} from "../src/domain/evaluation/accessCode";
import { isCalendarDate } from "../src/domain/evaluation/calendar";
import { gradeAnswer, gradeEvaluation } from "../src/domain/evaluation/scoring";
import { policyFor } from "../src/domain/game/levels";
import { ProgramError, compile, countBlocks, parseProgram, usesOnly } from "../src/domain/game/program";
import { simulate } from "../src/domain/game/simulator";
import type { Doc, Id } from "./_generated/dataModel";
import { type QueryCtx, mutation, query } from "./_generated/server";
import { classroomLabel, requireStudent } from "./lib/access";

const SESSION_MS = 8 * 60 * 60 * 1000; // una jornada escolar

async function questionsOf(ctx: QueryCtx, evaluationId: Id<"evaluations">) {
  return await ctx.db
    .query("questions")
    .withIndex("by_evaluation_order", (q) => q.eq("evaluationId", evaluationId))
    .collect();
}

async function attemptOf(ctx: QueryCtx, studentId: Id<"students">, evaluationId: Id<"evaluations">) {
  return await ctx.db
    .query("attempts")
    .withIndex("by_student_evaluation", (q) => q.eq("studentId", studentId).eq("evaluationId", evaluationId))
    .unique();
}

async function requireOwnAttempt(ctx: QueryCtx, token: string, attemptId: Id<"attempts">) {
  const { student, classroom } = await requireStudent(ctx, token);
  const attempt = await ctx.db.get(attemptId);
  if (!attempt || attempt.studentId !== student._id) throw new ConvexError("No encontramos tu evaluación.");
  return { student, classroom, attempt };
}

/** Cantidad de bloques del programa: dato informativo, nunca invalida la respuesta. */
function blocksIn(program: unknown): number {
  try {
    return countBlocks(parseProgram(program));
  } catch {
    return 0;
  }
}

const toPublicQuestion = (q: Doc<"questions">, stage: number) => ({
  stage,
  prompt: q.prompt,
  options: q.options,
  points: q.points,
});

export const signIn = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const accessCode = normalizeAccessCode(code);
    if (!isValidAccessCode(accessCode)) throw new ConvexError("Ese código no es válido. Revisa las letras.");
    const student = await ctx.db
      .query("students")
      .withIndex("by_access_code", (q) => q.eq("accessCode", accessCode))
      .unique();
    if (!student) throw new ConvexError("No encontramos ese código. Pídele ayuda a tu profesora o profesor.");
    const token = generateSessionToken();
    await ctx.db.insert("studentSessions", { studentId: student._id, token, expiresAt: Date.now() + SESSION_MS });
    return { token, displayName: student.displayName };
  },
});

export const signOut = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const session = await ctx.db
      .query("studentSessions")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (session) await ctx.db.delete(session._id);
  },
});

/** Lo que ve el alumno al entrar: su evaluación del día, directamente. */
export const home = query({
  args: { token: v.string(), today: v.string() },
  handler: async (ctx, { token, today }) => {
    if (!isCalendarDate(today)) throw new ConvexError("Fecha no válida.");
    const { student, classroom } = await requireStudent(ctx, token);
    const evaluations = await ctx.db
      .query("evaluations")
      .withIndex("by_classroom_date", (q) => q.eq("classroomId", classroom._id).eq("scheduledDate", today))
      .collect();

    const items = await Promise.all(
      evaluations.map(async (e) => {
        const attempt = await attemptOf(ctx, student._id, e._id);
        const questions = await questionsOf(ctx, e._id);
        return {
          evaluationId: e._id,
          title: e.title,
          questionCount: questions.length,
          attemptId: attempt?._id ?? null,
          stage: attempt?.stage ?? 0,
          finished: attempt?.finishedAt !== undefined,
          createdAt: e.createdAt,
        };
      }),
    );
    items.sort((a, b) => a.createdAt - b.createdAt);
    // La primera sin terminar; si terminó todas, muestra la última para ver su resultado.
    const current = items.find((i) => !i.finished) ?? items.at(-1) ?? null;
    return {
      displayName: student.displayName,
      level: classroom.level,
      classroomLabel: classroomLabel(classroom),
      evaluation: current,
      pendingCount: items.filter((i) => !i.finished).length,
    };
  },
});

export const start = mutation({
  args: { token: v.string(), evaluationId: v.id("evaluations") },
  handler: async (ctx, { token, evaluationId }) => {
    const { student, classroom } = await requireStudent(ctx, token);
    const evaluation = await ctx.db.get(evaluationId);
    if (!evaluation || evaluation.classroomId !== classroom._id) {
      throw new ConvexError("Esa evaluación no es de tu clase.");
    }
    const existing = await attemptOf(ctx, student._id, evaluationId);
    if (existing) return existing._id;
    return await ctx.db.insert("attempts", {
      evaluationId,
      studentId: student._id,
      startedAt: Date.now(),
      stage: 0,
    });
  },
});

/** Estado del intento para reanudar justo donde quedó el alumno. */
export const attempt = query({
  args: { token: v.string(), attemptId: v.id("attempts") },
  handler: async (ctx, { token, attemptId }) => {
    const { classroom, attempt } = await requireOwnAttempt(ctx, token, attemptId);
    const evaluation = await ctx.db.get(attempt.evaluationId);
    const questions = await questionsOf(ctx, attempt.evaluationId);
    const pending = attempt.questionShownAt !== undefined ? questions[attempt.stage] : undefined;
    return {
      title: evaluation?.title ?? "",
      level: classroom.level,
      stage: attempt.stage,
      questionCount: questions.length,
      finished: attempt.finishedAt !== undefined,
      pendingQuestion: pending ? toPublicQuestion(pending, attempt.stage) : null,
    };
  },
});

/**
 * El alumno dice que su programa llegó a la estrella. El servidor lo verifica
 * con el mismo simulador y, si es cierto, desbloquea la pregunta de la etapa.
 */
export const reachObjective = mutation({
  args: { token: v.string(), attemptId: v.id("attempts"), program: v.any() },
  handler: async (ctx, { token, attemptId, program }) => {
    const { classroom, attempt } = await requireOwnAttempt(ctx, token, attemptId);
    if (attempt.finishedAt !== undefined) throw new ConvexError("Ya terminaste esta evaluación.");
    const questions = await questionsOf(ctx, attempt.evaluationId);
    const question = questions[attempt.stage];
    if (!question) throw new ConvexError("No hay más preguntas.");

    if (attempt.questionShownAt === undefined) {
      const policy = policyFor(classroom.level);
      let outcomeKind: string;
      try {
        const parsed = parseProgram(program);
        if (!usesOnly(parsed, policy.palette)) throw new ConvexError("Usaste un bloque que no está disponible.");
        outcomeKind = simulate(policy.mapFor(attempt.stage), compile(parsed)).outcome.kind;
      } catch (error) {
        if (error instanceof ProgramError) throw new ConvexError(error.message);
        throw error;
      }
      if (outcomeKind !== "GOAL") throw new ConvexError("El robot todavía no llega a la estrella.");
      await ctx.db.patch(attempt._id, { questionShownAt: Date.now() });
    }
    return toPublicQuestion(question, attempt.stage);
  },
});

export const answer = mutation({
  args: {
    token: v.string(),
    attemptId: v.id("attempts"),
    chosenOption: v.number(),
    program: v.any(),
    runs: v.number(),
  },
  handler: async (ctx, args) => {
    const { attempt } = await requireOwnAttempt(ctx, args.token, args.attemptId);
    if (attempt.finishedAt !== undefined) throw new ConvexError("Ya terminaste esta evaluación.");
    if (attempt.questionShownAt === undefined) throw new ConvexError("Primero lleva al robot a la estrella.");
    const questions = await questionsOf(ctx, attempt.evaluationId);
    const question = questions[attempt.stage];
    if (!question) throw new ConvexError("No hay más preguntas.");
    if (!Number.isInteger(args.chosenOption) || args.chosenOption < 0 || args.chosenOption >= question.options.length) {
      throw new ConvexError("Elige una de las alternativas.");
    }

    const now = Date.now();
    const graded = gradeAnswer(
      { questionId: question._id, correctOption: question.correctOption, points: question.points },
      { questionId: question._id, chosenOption: args.chosenOption, shownAt: attempt.questionShownAt, answeredAt: now },
    );
    const blocksUsed = blocksIn(args.program);
    await ctx.db.insert("answers", {
      attemptId: attempt._id,
      questionId: question._id,
      stage: attempt.stage,
      chosenOption: args.chosenOption,
      isCorrect: graded.isCorrect,
      pointsAwarded: graded.pointsAwarded,
      shownAt: graded.shownAt,
      answeredAt: graded.answeredAt,
      blocksUsed,
      runs: Math.max(1, Math.floor(args.runs)),
    });

    const nextStage = attempt.stage + 1;
    if (nextStage < questions.length) {
      await ctx.db.patch(attempt._id, { stage: nextStage, questionShownAt: undefined });
      return { isCorrect: graded.isCorrect, finished: false };
    }

    const answers = await ctx.db
      .query("answers")
      .withIndex("by_attempt", (q) => q.eq("attemptId", attempt._id))
      .collect();
    const result = gradeEvaluation(
      questions.map((q) => ({ questionId: q._id, correctOption: q.correctOption, points: q.points })),
      answers.map((a) => ({ questionId: a.questionId, chosenOption: a.chosenOption, shownAt: a.shownAt, answeredAt: a.answeredAt })),
      attempt.startedAt,
      now,
    );
    await ctx.db.patch(attempt._id, {
      stage: nextStage,
      questionShownAt: undefined,
      finishedAt: now,
      score: result.score,
      maxScore: result.maxScore,
      percent: result.percent,
      totalMs: result.totalMs,
    });
    return { isCorrect: graded.isCorrect, finished: true };
  },
});

export const result = query({
  args: { token: v.string(), attemptId: v.id("attempts") },
  handler: async (ctx, { token, attemptId }) => {
    const { attempt } = await requireOwnAttempt(ctx, token, attemptId);
    if (attempt.finishedAt === undefined) return null;
    const answers = await ctx.db
      .query("answers")
      .withIndex("by_attempt", (q) => q.eq("attemptId", attempt._id))
      .collect();
    answers.sort((a, b) => a.stage - b.stage);
    return {
      score: attempt.score ?? 0,
      maxScore: attempt.maxScore ?? 0,
      percent: attempt.percent ?? 0,
      totalMs: attempt.totalMs ?? 0,
      answers: answers.map((a) => ({
        stage: a.stage,
        isCorrect: a.isCorrect,
        responseMs: a.answeredAt - a.shownAt,
      })),
    };
  },
});
