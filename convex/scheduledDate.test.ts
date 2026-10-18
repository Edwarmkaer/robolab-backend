import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { move } from "../domain/game/program";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

const F = move("FORWARD");
const QUESTIONS = [{ prompt: "¿2+2?", options: ["3", "4"], correctOption: 1, points: 1 }];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(Date.UTC(2026, 9, 17, 20, 0)); // 17 de octubre, 3 de la tarde en Lima
});

afterEach(() => {
  vi.useRealTimers();
});

async function withClass() {
  const t = convexTest(schema, modules);
  const teacherId = await t.run((ctx) => ctx.db.insert("users", { name: "Rosa", email: "rosa@colegio.pe" }));
  const teacher = t.withIdentity({ subject: `${teacherId}|s1` });
  const classroomId = await teacher.mutation(api.classrooms.create, { level: "inicial", grade: "5 años", section: "A" });
  const [ana] = await teacher.mutation(api.classrooms.addStudents, { classroomId, names: ["Ana"] });
  const signedIn = await t.mutation(api.student.signIn, { code: ana!.accessCode });
  if ("error" in signedIn) throw new Error(signedIn.error);
  const { token } = signedIn;
  const studentId = (await t.run((ctx) => ctx.db.query("students").unique()))!._id;
  const schedule = (title: string, scheduledDate: string) =>
    teacher.mutation(api.evaluations.create, { classroomId, title, scheduledDate, questions: QUESTIONS });
  return { t, token, schedule, studentId };
}

describe("el servidor decide qué día es", () => {
  it("el alumno solo ve la evaluación de hoy, aunque su tablet diga otra fecha", async () => {
    const { t, token, schedule } = await withClass();
    await schedule("Ayer", "2026-10-16");
    const today = await schedule("Hoy", "2026-10-17");
    await schedule("Mañana", "2026-10-18");

    const home = await t.query(api.student.home, { token, today: "2026-10-18" }); // fecha manipulada
    expect(home.evaluation?.evaluationId).toBe(today);
    expect(home.today).toBe("2026-10-17");
  });

  it("no deja empezar una evaluación de mañana ni volver a rendir una de ayer", async () => {
    const { t, token, schedule, studentId } = await withClass();
    const tomorrow = await schedule("Mañana", "2026-10-18");
    await expect(t.mutation(api.student.start, { token, evaluationId: tomorrow })).rejects.toThrow(/todavía no empieza/);

    const yesterday = await schedule("Ayer", "2026-10-16");
    await t.run((ctx) =>
      ctx.db.insert("attempts", {
        evaluationId: yesterday,
        studentId,
        number: 1,
        startedAt: Date.UTC(2026, 9, 16, 15, 0),
        stage: 1,
        finishedAt: Date.UTC(2026, 9, 16, 15, 5),
        score: 1,
        maxScore: 1,
        percent: 100,
        totalMs: 300_000,
        totalRuns: 2,
      }),
    );
    await expect(t.mutation(api.student.retry, { token, evaluationId: yesterday })).rejects.toThrow(/ya pasó/);
  });

  it("un intento de otro día no se puede seguir jugando hoy", async () => {
    const { t, token, schedule, studentId } = await withClass();
    const yesterday = await schedule("Ayer", "2026-10-16");
    const attemptId = await t.run((ctx) =>
      ctx.db.insert("attempts", { evaluationId: yesterday, studentId, number: 1, startedAt: Date.UTC(2026, 9, 16, 15, 0), stage: 0 }),
    );
    await expect(t.mutation(api.student.submitRun, { token, attemptId, program: [F, F, F] })).rejects.toThrow(/ya pasó/);
    await expect(t.mutation(api.student.answer, { token, attemptId, chosenOption: 1, program: [] })).rejects.toThrow(/ya pasó/);
  });

  it("la de hoy se juega completa", async () => {
    const { t, token, schedule } = await withClass();
    const today = await schedule("Hoy", "2026-10-17");
    const attemptId = await t.mutation(api.student.start, { token, evaluationId: today });
    await expect(t.mutation(api.student.submitRun, { token, attemptId, program: [F, F, F] })).resolves.toMatchObject({ outcome: "GOAL" });
    await expect(t.mutation(api.student.answer, { token, attemptId, chosenOption: 1, program: [] })).resolves.toEqual({ isCorrect: true, finished: true });
    await expect(t.mutation(api.student.retry, { token, evaluationId: today })).resolves.toBeTruthy();
  });
});
