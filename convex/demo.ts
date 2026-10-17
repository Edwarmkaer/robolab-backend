/**
 * Carga datos de ejemplo para presentar la app. Es una función interna: no
 * se puede llamar desde el navegador, solo desde la consola de Convex:
 *
 *   npx convex run demo:seed '{"email":"docente@colegio.pe","today":"2026-10-17"}'
 *
 * El docente se registra primero en la app con su propia contraseña; aquí
 * solo se le agrega una clase con historia. Nunca se guardan contraseñas.
 */
import { ConvexError, v } from "convex/values";
import { addDays } from "../src/domain/evaluation/calendar";
import { gradeEvaluation } from "../src/domain/evaluation/scoring";
import type { Id } from "./_generated/dataModel";
import { internalMutation } from "./_generated/server";
import { uniqueAccessCode } from "./lib/codes";
import {
  ABSENCE_RATE,
  DEMO_CLASS,
  DEMO_EVALUATIONS,
  DEMO_SEED,
  DEMO_STUDENTS,
  seededRandom,
  simulateAttempt,
} from "./lib/demoData";
import { LIMITS, cleanQuestions, cleanText, requireCalendarDate } from "./lib/rules";

const HOUR_MS = 60 * 60 * 1000;

/** 9:30 en Lima (UTC−5) de esa fecha: hora de clase, solo para que los tiempos se vean reales. */
function classTime(date: string): number {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d, 14, 30);
}

export const seed = internalMutation({
  args: { email: v.string(), today: v.string(), section: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const today = requireCalendarDate(args.today);
    const email = args.email.trim().toLowerCase();
    const teacher = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .unique();
    if (!teacher) throw new ConvexError(`No hay un docente registrado con ${email}. Regístralo primero en la app.`);

    const section = cleanText(args.section ?? DEMO_CLASS.section, "Sección", 1, LIMITS.sectionMax).toUpperCase();
    const mine = await ctx.db
      .query("classrooms")
      .withIndex("by_teacher", (q) => q.eq("teacherId", teacher._id))
      .collect();
    const sameClass = (c: (typeof mine)[number]) =>
      c.level === DEMO_CLASS.level && c.grade.toLowerCase() === DEMO_CLASS.grade.toLowerCase() && c.section === section;
    if (mine.some(sameClass)) {
      throw new ConvexError("Ya existe la clase de demostración para este docente.");
    }

    const firstDate = addDays(today, -Math.max(...DEMO_EVALUATIONS.map((e) => e.daysAgo)));
    const classroomId = await ctx.db.insert("classrooms", {
      teacherId: teacher._id,
      level: DEMO_CLASS.level,
      grade: DEMO_CLASS.grade,
      section,
      createdAt: classTime(firstDate) - 3 * 24 * HOUR_MS,
    });

    const students: { id: Id<"students">; profile: (typeof DEMO_STUDENTS)[number] }[] = [];
    for (const profile of DEMO_STUDENTS) {
      const id = await ctx.db.insert("students", {
        classroomId,
        displayName: profile.name,
        accessCode: await uniqueAccessCode(ctx),
        createdAt: classTime(firstDate) - 3 * 24 * HOUR_MS,
      });
      students.push({ id, profile });
    }

    const random = seededRandom(DEMO_SEED);
    let attempts = 0;
    for (const [session, demo] of DEMO_EVALUATIONS.entries()) {
      const date = addDays(today, -demo.daysAgo);
      const evaluationId = await ctx.db.insert("evaluations", {
        teacherId: teacher._id,
        classroomId,
        title: demo.title,
        scheduledDate: date,
        createdAt: classTime(date) - 18 * HOUR_MS,
      });
      // Las mismas validaciones que una evaluación creada desde la app.
      const questions = cleanQuestions(demo.questions.map((q) => ({ ...q, options: [...q.options] })));
      const questionIds: Id<"questions">[] = [];
      for (const [order, q] of questions.entries()) {
        questionIds.push(await ctx.db.insert("questions", { evaluationId, order, ...q }));
      }
      if (demo.daysAgo === 0) continue; // la de hoy se juega en vivo

      const keys = questions.map((q, i) => ({ questionId: questionIds[i]!, correctOption: q.correctOption, points: q.points }));
      for (const [turn, student] of students.entries()) {
        if (random() < ABSENCE_RATE) continue;
        const startedAt = classTime(date) + turn * 4 * 60 * 1000; // pasan de a uno a la tablet
        const simulated = simulateAttempt(random, student.profile, session, questions, startedAt);
        const records = simulated.answers.map((a, i) => ({ ...a, questionId: questionIds[i]! }));
        const result = gradeEvaluation(keys, records, startedAt, simulated.finishedAt);

        const attemptId = await ctx.db.insert("attempts", {
          evaluationId,
          studentId: student.id,
          startedAt,
          stage: questions.length,
          finishedAt: simulated.finishedAt,
          score: result.score,
          maxScore: result.maxScore,
          percent: result.percent,
          totalMs: result.totalMs,
        });
        for (const [stage, graded] of result.answers.entries()) {
          const raw = records[stage]!;
          await ctx.db.insert("answers", {
            attemptId,
            questionId: questionIds[stage]!,
            stage,
            chosenOption: graded.chosenOption,
            isCorrect: graded.isCorrect,
            pointsAwarded: graded.pointsAwarded,
            shownAt: graded.shownAt,
            answeredAt: graded.answeredAt,
            blocksUsed: raw.blocksUsed,
            runs: raw.runs,
          });
        }
        attempts++;
      }
    }

    return { classroomId, students: students.length, evaluations: DEMO_EVALUATIONS.length, attempts };
  },
});
