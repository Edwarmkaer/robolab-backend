import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { move } from "../domain/game/program";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { modules } from "./test.setup";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(Date.UTC(2026, 9, 17, 20, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

const F = move("FORWARD");
const TODAY = "2026-10-17";

type T = ReturnType<typeof convexTest>;
type Teacher = ReturnType<T["withIdentity"]>;

/** Una clase con todo lo que puede colgar de ella: alumnos de ambos tipos, sesión, partidas, reto asignado y evaluación rendida. */
async function fullClassroom(t: T, teacher: Teacher, section: string) {
  const classroomId = await teacher.mutation(api.classrooms.create, { level: "inicial", grade: "5 años", section });
  const { joinCode } = await teacher.query(api.classrooms.get, { classroomId });
  const joined = await t.mutation(api.student.join, { code: joinCode!, nickname: "Pingüino veloz" });
  if ("error" in joined) throw new Error(joined.error);
  const [legacy] = await teacher.mutation(api.classrooms.addStudents, { classroomId, names: ["Ana"] });
  const signedIn = await t.mutation(api.student.signIn, { code: legacy!.accessCode });
  if ("error" in signedIn) throw new Error(signedIn.error);

  await teacher.mutation(api.assignments.create, { challengeId: "inicial-paseo", visibility: "class", classroomId });
  await t.mutation(api.student.recordChallengePlay, { token: joined.token, challengeId: "inicial-paseo", program: [F, F, F], runs: 1, hints: 0, ms: 1000 });

  const evaluationId = await teacher.mutation(api.evaluations.create, {
    classroomId,
    title: `Evaluación ${section}`,
    scheduledDate: TODAY,
    questions: [{ prompt: "¿2+2?", options: ["3", "4"], correctOption: 1, points: 1 }],
  });
  const attemptId = await t.mutation(api.student.start, { token: signedIn.token, evaluationId });
  await t.mutation(api.student.submitRun, { token: signedIn.token, attemptId, program: [F] });
  await t.mutation(api.student.submitRun, { token: signedIn.token, attemptId, program: [F, F, F] });
  await t.mutation(api.student.answer, { token: signedIn.token, attemptId, chosenOption: 1, program: [F, F, F] });
  return { classroomId, tokens: [joined.token, signedIn.token], evaluationId, attemptId };
}

/** Cuántas filas de cada tabla siguen apuntando a la clase, sus alumnos, su evaluación o su intento. */
async function rowsPointingTo(t: T, ids: { classroomId: Id<"classrooms">; evaluationId: Id<"evaluations">; attemptId: Id<"attempts"> }) {
  return await t.run(async (ctx) => {
    const students = (await ctx.db.query("students").collect()).filter((s) => s.classroomId === ids.classroomId);
    const studentIds = new Set(students.map((s) => s._id));
    const count = async <K extends "studentSessions" | "challengePlays" | "assignments" | "evaluations" | "questions" | "attempts" | "answers" | "runs">(
      table: K,
      keep: (row: Record<string, unknown>) => boolean,
    ) => (await ctx.db.query(table).collect()).filter((row) => keep(row as Record<string, unknown>)).length;
    return {
      classroom: (await ctx.db.get(ids.classroomId)) === null ? 0 : 1,
      students: students.length,
      sessions: await count("studentSessions", (r) => studentIds.has(r.studentId as Id<"students">)),
      plays: await count("challengePlays", (r) => r.classroomId === ids.classroomId),
      assignments: await count("assignments", (r) => r.classroomId === ids.classroomId),
      evaluations: await count("evaluations", (r) => r.classroomId === ids.classroomId),
      questions: await count("questions", (r) => r.evaluationId === ids.evaluationId),
      attempts: await count("attempts", (r) => r.evaluationId === ids.evaluationId),
      answers: await count("answers", (r) => r.attemptId === ids.attemptId),
      runs: await count("runs", (r) => r.attemptId === ids.attemptId),
    };
  });
}

describe("eliminar una clase", () => {
  it("borra en cascada todo lo de esa clase y no toca otra clase del mismo docente", async () => {
    const t = convexTest(schema, modules);
    const teacherId = await t.run((ctx) => ctx.db.insert("users", { name: "Ana", email: "ana@colegio.pe" }));
    const teacher = t.withIdentity({ subject: `${teacherId}|s1` });
    const a = await fullClassroom(t, teacher, "A");
    const b = await fullClassroom(t, teacher, "B");
    const full = { classroom: 1, students: 2, sessions: 2, plays: 1, assignments: 1, evaluations: 1, questions: 1, attempts: 1, answers: 1, runs: 2 };
    expect(await rowsPointingTo(t, a)).toEqual(full);
    expect(await rowsPointingTo(t, b)).toEqual(full);

    await teacher.mutation(api.classrooms.remove, { classroomId: a.classroomId });

    expect(await rowsPointingTo(t, a)).toEqual({ classroom: 0, students: 0, sessions: 0, plays: 0, assignments: 0, evaluations: 0, questions: 0, attempts: 0, answers: 0, runs: 0 });
    expect(await rowsPointingTo(t, b)).toEqual(full);
    expect(await teacher.query(api.classrooms.listMine, {})).toMatchObject([{ _id: b.classroomId }]);
    expect(await teacher.query(api.evaluations.listMine, {})).toMatchObject([{ title: "Evaluación B" }]);
    for (const token of a.tokens) await expect(t.query(api.student.home, { token })).rejects.toThrow(/sesión/);
    for (const token of b.tokens) await expect(t.query(api.student.home, { token })).resolves.toMatchObject({ classroomLabel: "Inicial · 5 años · Sección B" });
    await expect(teacher.query(api.classrooms.get, { classroomId: a.classroomId })).rejects.toThrow(/No encontramos/);
  });

  it("solo el docente dueño puede eliminarla", async () => {
    const t = convexTest(schema, modules);
    const anaId = await t.run((ctx) => ctx.db.insert("users", { name: "Ana", email: "ana@colegio.pe" }));
    const luisId = await t.run((ctx) => ctx.db.insert("users", { name: "Luis", email: "luis@colegio.pe" }));
    const teacher = t.withIdentity({ subject: `${anaId}|s1` });
    const other = t.withIdentity({ subject: `${luisId}|s2` });
    const { classroomId } = await fullClassroom(t, teacher, "A");
    await expect(other.mutation(api.classrooms.remove, { classroomId })).rejects.toThrow(/No encontramos/);
    await expect(t.mutation(api.classrooms.remove, { classroomId })).rejects.toThrow(/Inicia sesión/);
    expect(await teacher.query(api.classrooms.listMine, {})).toHaveLength(1);
  });
});
