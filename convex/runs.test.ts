import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { move } from "../domain/game/program";
import { api } from "./_generated/api";
import schema from "./schema";
import { RUNS_PER_MINUTE, RUN_WINDOW_MS } from "./student";
import { modules } from "./test.setup";

// Las evaluaciones de estas pruebas son del 17 de octubre de 2026: el reloj del servidor se fija ese día (3 p. m. en Lima).
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(Date.UTC(2026, 9, 17, 20, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

const F = move("FORWARD");

/** Un alumno con una evaluación de una pregunta empezada. En su mapa, tres "avanzar" llegan a la estrella. */
async function withAttempt() {
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
  const signedIn = await t.mutation(api.student.signIn, { code: ana!.accessCode });
  if ("error" in signedIn) throw new Error(signedIn.error);
  const { token } = signedIn;
  const attemptId = await t.mutation(api.student.start, { token, evaluationId });
  const run = (program: unknown[]) => t.mutation(api.student.submitRun, { token, attemptId, program });
  return { t, token, attemptId, evaluationId, run };
}

describe("un niño que toca Ejecutar muchas veces seguidas", () => {
  it("recibe un respiro de un minuto, y pasado el minuto su solución se acepta: nunca queda bloqueado", async () => {
    const { run } = await withAttempt();
    for (let i = 0; i < RUNS_PER_MINUTE; i++) await run([F]); // programas incompletos, uno tras otro
    await expect(run([F, F, F])).rejects.toThrow(/respiro/);

    vi.setSystemTime(Date.now() + RUN_WINDOW_MS + 1000);
    await expect(run([F, F, F])).resolves.toMatchObject({ outcome: "GOAL" });
  });

  it("solo cuentan las ejecuciones del último minuto, no las de toda la estrella", async () => {
    const { run } = await withAttempt();
    for (let i = 0; i < RUNS_PER_MINUTE; i++) await run([F]);
    vi.setSystemTime(Date.now() + RUN_WINDOW_MS + 1000);
    for (let i = 0; i < RUNS_PER_MINUTE - 1; i++) await run([F]); // otro minuto casi lleno: más de 30 en total
    await expect(run([F, F, F])).resolves.toMatchObject({ outcome: "GOAL" });
  });
});
