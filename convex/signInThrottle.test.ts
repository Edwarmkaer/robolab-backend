import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { MAX_FAILED_SIGNINS_PER_MINUTE, SIGNIN_WINDOW_MS } from "./student";
import { modules } from "./test.setup";

afterEach(() => {
  vi.useRealTimers();
});

async function withStudent() {
  const t = convexTest(schema, modules);
  const teacherId = await t.run((ctx) => ctx.db.insert("users", { name: "Rosa", email: "rosa@colegio.pe" }));
  const teacher = t.withIdentity({ subject: `${teacherId}|s1` });
  const classroomId = await teacher.mutation(api.classrooms.create, { level: "inicial", grade: "5 años", section: "A" });
  const [ana] = await teacher.mutation(api.classrooms.addStudents, { classroomId, names: ["Ana"] });
  return { t, code: ana!.accessCode };
}

/** Códigos válidos en forma pero que no existen. */
const guess = (i: number) => `Z${String(i).padStart(5, "9").replace(/[01]/g, "7")}`;

describe("adivinar códigos de alumno", () => {
  it("tras muchos códigos fallidos seguidos, se frena a todos por un minuto; después vuelve a funcionar", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const { t, code } = await withStudent();
    for (let i = 0; i < MAX_FAILED_SIGNINS_PER_MINUTE; i++) {
      expect(await t.mutation(api.student.signIn, { code: guess(i) })).toMatchObject({ error: expect.stringMatching(/No encontramos/) });
    }
    // El freno aplica incluso al código correcto: así un atacante no gana nada probando más rápido.
    expect(await t.mutation(api.student.signIn, { code })).toMatchObject({ error: expect.stringMatching(/Espera un minuto/) });

    vi.setSystemTime(Date.now() + SIGNIN_WINDOW_MS + 1000);
    await expect(t.mutation(api.student.signIn, { code })).resolves.toMatchObject({ displayName: "Ana" });
  });

  it("los intentos normales de un aula no se frenan", async () => {
    const { t, code } = await withStudent();
    for (let i = 0; i < 5; i++) expect(await t.mutation(api.student.signIn, { code: guess(i) })).toMatchObject({ error: expect.stringMatching(/No encontramos/) });
    await expect(t.mutation(api.student.signIn, { code: code.toLowerCase() })).resolves.toMatchObject({ displayName: "Ana" });
  });
});
