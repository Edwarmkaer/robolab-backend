import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { move } from "../domain/game/program";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

const F = move("FORWARD");
const DEVICE = "a".repeat(32);
const OTHER = "b".repeat(32);

// "Primer paseo": tres avanzar llegan a la estrella.
const play = (t: ReturnType<typeof convexTest>, deviceId: string, program: unknown[], hints = 0) =>
  t.mutation(api.explore.recordPlay, { deviceId, challengeId: "inicial-paseo", program, runs: 2, hints, ms: 30_000 });

describe("panel de impacto", () => {
  it("cuenta partidas y personas sin guardar nombres: dos partidas del mismo dispositivo son una persona", async () => {
    const t = convexTest(schema, modules);
    await play(t, DEVICE, [F], 1); // no llega
    await play(t, DEVICE, [F, F, F], 1); // llega, con pista
    await play(t, OTHER, [F, F, F]);

    const s = await t.query(api.impact.summary, {});
    expect(s.total).toMatchObject({ plays: 3, solved: 2, devices: 2, successRate: 67, avgRunsToSolve: 2, avgMinutesToSolve: 0.5, hintsHelped: 50 });
    expect(s.todayStats.plays).toBe(3);
    expect(JSON.stringify(s)).not.toContain(DEVICE);
  });

  it("una evaluación terminada en clase suma al día y al total, y al alumno una sola vez", async () => {
    const t = convexTest(schema, modules);
    const teacherId = await t.run((ctx) => ctx.db.insert("users", { name: "Rosa", email: "rosa@colegio.pe" }));
    const teacher = t.withIdentity({ subject: `${teacherId}|s1` });
    const classroomId = await teacher.mutation(api.classrooms.create, { level: "inicial", grade: "5 años", section: "A" });
    const [ana] = await teacher.mutation(api.classrooms.addStudents, { classroomId, names: ["Ana"] });
    const evaluationId = await teacher.mutation(api.evaluations.create, {
      classroomId,
      title: "Hoy",
      scheduledDate: "2026-10-17",
      questions: [{ prompt: "¿2+2?", options: ["3", "4"], correctOption: 1, points: 1 }],
    });
    const { token } = await t.mutation(api.student.signIn, { code: ana!.accessCode });
    for (let i = 0; i < 2; i++) {
      const attemptId = i === 0 ? await t.mutation(api.student.start, { token, evaluationId }) : await t.mutation(api.student.retry, { token, evaluationId });
      await t.mutation(api.student.submitRun, { token, attemptId, program: [F, F, F] });
      await t.mutation(api.student.answer, { token, attemptId, chosenOption: 1, program: [F, F, F] });
    }

    const s = await t.query(api.impact.summary, {});
    expect(s.total).toMatchObject({ attemptsFinished: 2, students: 1 });
    expect(s.todayStats).toMatchObject({ attemptsFinished: 2, students: 1 });
    expect(JSON.stringify(s)).not.toContain("Ana");

    // Recalcular desde cero da lo mismo que contar sobre la marcha.
    const rebuilt = await t.mutation(internal.impact.rebuild, {});
    expect(rebuilt).toEqual(s.total);
  });
});
