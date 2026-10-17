import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

const TODAY = "2026-10-17";

async function setup() {
  const t = convexTest(schema, modules);
  const teacherId = await t.run((ctx) => ctx.db.insert("users", { name: "Rosa", email: "rosa@colegio.pe" }));
  const teacher = t.withIdentity({ subject: `${teacherId}|sesion-1` });
  return { t, teacher };
}

async function seededProgress() {
  const { t, teacher } = await setup();
  const created = await t.mutation(internal.demo.seed, { email: " Rosa@Colegio.pe ", today: TODAY });
  const progress = await teacher.query(api.analytics.classProgress, { classroomId: created.classroomId });
  return { t, teacher, created, progress };
}

describe("datos de demostración", () => {
  it("solo se cargan para un docente que ya existe", async () => {
    const { t } = await setup();
    await expect(t.mutation(internal.demo.seed, { email: "nadie@colegio.pe", today: TODAY })).rejects.toThrow(
      /No hay un docente/,
    );
    await expect(t.mutation(internal.demo.seed, { email: "rosa@colegio.pe", today: "17/10/2026" })).rejects.toThrow();
  });

  it("crea una clase con historia: evaluaciones pasadas calificadas y una de hoy sin empezar", async () => {
    const { progress } = await seededProgress();
    const dates = progress.evaluations.map((e) => e.date);
    expect(dates).toEqual([...dates].sort());
    expect(dates.at(-1)).toBe(TODAY);

    const past = progress.evaluations.slice(0, -1);
    expect(past.length).toBeGreaterThanOrEqual(3);
    for (const e of past) {
      expect(e.average).not.toBeNull();
      expect(e.finishedCount).toBeGreaterThan(0);
    }
    expect(progress.evaluations.at(-1)).toMatchObject({ average: null, finishedCount: 0 });

    // La clase mejora con el tiempo, que es lo que el docente quiere ver.
    expect(past.at(-1)!.average!).toBeGreaterThan(past[0]!.average!);
    expect(progress.students.length).toBeGreaterThanOrEqual(10);
  });

  it("refleja faltas como huecos en vez de inventar notas", async () => {
    const { progress } = await seededProgress();
    const pastValues = progress.students.flatMap((s) => s.series.slice(0, -1).map((p) => p.percent));
    expect(pastValues).toContain(null);
    expect(pastValues.filter((v) => v !== null).every((v) => v >= 0 && v <= 100)).toBe(true);
  });

  it("cada nota coincide con sus respuestas, calificadas con las mismas reglas", async () => {
    const { t, created } = await seededProgress();
    const rows = await t.run(async (ctx) => {
      const evaluations = await ctx.db
        .query("evaluations")
        .withIndex("by_classroom_date", (q) => q.eq("classroomId", created.classroomId))
        .collect();
      return await Promise.all(
        evaluations.map(async (e) => {
          const questions = await ctx.db
            .query("questions")
            .withIndex("by_evaluation_order", (q) => q.eq("evaluationId", e._id))
            .collect();
          const attempts = await ctx.db
            .query("attempts")
            .withIndex("by_evaluation", (q) => q.eq("evaluationId", e._id))
            .collect();
          const withAnswers = await Promise.all(
            attempts.map(async (a) => ({
              attempt: a,
              answers: await ctx.db
                .query("answers")
                .withIndex("by_attempt", (q) => q.eq("attemptId", a._id))
                .collect(),
            })),
          );
          return { questions, attempts: withAnswers };
        }),
      );
    });

    for (const { questions, attempts } of rows) {
      const maxScore = questions.reduce((s, q) => s + q.points, 0);
      for (const { attempt, answers } of attempts) {
        expect(answers).toHaveLength(questions.length);
        expect(attempt.score).toBe(answers.reduce((s, a) => s + a.pointsAwarded, 0));
        expect(attempt.maxScore).toBe(maxScore);
        expect(attempt.percent).toBe(Math.round((attempt.score! / maxScore) * 100));
        for (const a of answers) {
          const q = questions.find((x) => x._id === a.questionId)!;
          expect(a.isCorrect).toBe(a.chosenOption === q.correctOption);
          expect(a.chosenOption).toBeLessThan(q.options.length);
          expect(a.answeredAt).toBeGreaterThan(a.shownAt);
          expect(a.shownAt).toBeGreaterThanOrEqual(attempt.startedAt);
          expect(a.answeredAt).toBeLessThanOrEqual(attempt.finishedAt!);
        }
      }
    }
  });

  it("la evaluación de hoy se puede jugar en vivo con un código de la clase", async () => {
    const { t, teacher, created } = await seededProgress();
    const classroom = await teacher.query(api.classrooms.get, { classroomId: created.classroomId });
    const student = classroom.students[0]!;
    const { token } = await t.mutation(api.student.signIn, { code: student.accessCode });
    const home = await t.query(api.student.home, { token, today: TODAY });
    expect(home.evaluation).toMatchObject({ finished: false, attemptId: null });
  });

  it("es reproducible y no se duplica", async () => {
    const first = await seededProgress();
    const second = await seededProgress();
    const percents = (p: typeof first.progress) => p.students.map((s) => s.series.map((x) => x.percent));
    expect(percents(second.progress)).toEqual(percents(first.progress));

    await expect(first.t.mutation(internal.demo.seed, { email: "rosa@colegio.pe", today: TODAY })).rejects.toThrow(
      /Ya existe/,
    );
  });
});
