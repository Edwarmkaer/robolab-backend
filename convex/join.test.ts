import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { move } from "../domain/game/program";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { MAX_FAILED_SIGNINS_PER_MINUTE, MAX_STUDENTS_PER_CLASS, SIGNIN_WINDOW_MS } from "./student";
import { modules } from "./test.setup";

// Reloj del servidor fijo: 17 de octubre de 2026, 3 p. m. en Lima.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(Date.UTC(2026, 9, 17, 20, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

const F = move("FORWARD");

async function setup() {
  const t = convexTest(schema, modules);
  const teacherId = await t.run((ctx) => ctx.db.insert("users", { name: "Ana Pérez", email: "ana@colegio.pe" }));
  const teacher = t.withIdentity({ subject: `${teacherId}|s1` });
  const classroomId = await teacher.mutation(api.classrooms.create, { level: "inicial", grade: "5 años", section: "A" });
  return { t, teacher, classroomId, joinCode: await codeOf(teacher, classroomId) };
}

type T = ReturnType<typeof convexTest>;
type Teacher = ReturnType<T["withIdentity"]>;

/** El código de la clase se consulta: `classrooms.create` sigue devolviendo solo el Id. */
async function codeOf(teacher: Teacher, classroomId: Id<"classrooms">): Promise<string> {
  const { joinCode } = await teacher.query(api.classrooms.get, { classroomId });
  if (!joinCode) throw new Error("La clase no tiene código.");
  return joinCode;
}

async function join(t: T, code: string, nickname: string) {
  const joined = await t.mutation(api.student.join, { code, nickname });
  if ("error" in joined) throw new Error(joined.error);
  return joined;
}

const playPaseo = (t: T, token: string, program: unknown[], hints = 0) =>
  t.mutation(api.student.recordChallengePlay, { token, challengeId: "inicial-paseo", program, runs: 2, hints, ms: 30_000 });

describe("unirse a la clase con código y apodo", () => {
  it("la clase nace con un código ABC-123 que se ve en la lista del docente", async () => {
    const { teacher, joinCode, classroomId } = await setup();
    expect(joinCode).toMatch(/^[A-Z]{3}-[0-9]{3}$/);
    expect(await teacher.query(api.classrooms.listMine, {})).toMatchObject([{ _id: classroomId, joinCode, studentCount: 0 }]);
  });

  it("el alumno entra con el código (como lo escriba) y su apodo, y el docente lo ve en su clase", async () => {
    const { t, teacher, joinCode, classroomId } = await setup();
    const joined = await t.mutation(api.student.join, {
      code: ` ${joinCode.toLowerCase().replace("-", " ")} `,
      nickname: "pingüino veloz",
    });
    expect(joined).toMatchObject({ displayName: "Pingüino veloz", classroomLabel: "Inicial · 5 años · Sección A" });
    if ("error" in joined) throw new Error(joined.error);

    const home = await t.query(api.student.home, { token: joined.token });
    expect(home).toMatchObject({ displayName: "Pingüino veloz", joinCode, classChallenges: [], evaluation: null });

    const classroom = await teacher.query(api.classrooms.get, { classroomId });
    expect(classroom).toMatchObject({ joinCode, studentCount: 1, label: "Inicial · 5 años · Sección A" });
    expect(classroom.students).toMatchObject([
      { displayName: "Pingüino veloz", retosHechos: 0, retosTotal: 0, lastChallengeTitle: null, status: "not_started" },
    ]);
    expect(await teacher.query(api.classrooms.listMine, {})).toMatchObject([{ studentCount: 1 }]);
  });

  it("rechaza un apodo que ya está en la clase, sin distinguir mayúsculas ni tildes", async () => {
    const { t, teacher, joinCode } = await setup();
    await join(t, joinCode, "Cóndor Azul");
    await expect(t.mutation(api.student.join, { code: joinCode, nickname: "condor azul" })).rejects.toThrow(
      "Ese apodo ya está en uso en tu clase. Elige otro.",
    );
    // En otra clase el mismo apodo sí se puede usar.
    const other = await teacher.mutation(api.classrooms.create, { level: "inicial", grade: "4 años", section: "B" });
    await expect(join(t, await codeOf(teacher, other), "condor azul")).resolves.toMatchObject({ displayName: "Condor azul" });
  });

  it("rechaza apodos inválidos diciendo por qué", async () => {
    const { t, joinCode } = await setup();
    await expect(t.mutation(api.student.join, { code: joinCode, nickname: "Ana3" })).rejects.toThrow(/no permitidos/);
    await expect(t.mutation(api.student.join, { code: joinCode, nickname: "x" })).rejects.toThrow(/Muy corto/);
    await expect(t.mutation(api.student.join, { code: joinCode, nickname: "a".repeat(25) })).rejects.toThrow(/máximo 24/);
  });

  it("con un código que no existe devuelve error; tras muchos fallos frena a todos por un minuto, igual que signIn", async () => {
    const { t, joinCode } = await setup();
    const wrong = { code: "ZZZ-999", nickname: "Puma rápido" };
    expect(await t.mutation(api.student.join, wrong)).toEqual({ error: "No encontramos esa clase. Revisa el código." });
    expect(await t.mutation(api.student.join, { ...wrong, code: "abc" })).toEqual({ error: "No encontramos esa clase. Revisa el código." });
    for (let i = 2; i < MAX_FAILED_SIGNINS_PER_MINUTE; i++) await t.mutation(api.student.join, wrong);

    expect(await t.mutation(api.student.join, { code: joinCode, nickname: "Puma rápido" })).toMatchObject({
      error: expect.stringMatching(/Espera un minuto/),
    });
    expect(await t.mutation(api.student.signIn, { code: "ABCDEF" })).toMatchObject({ error: expect.stringMatching(/Espera un minuto/) });

    vi.setSystemTime(Date.now() + SIGNIN_WINDOW_MS + 1000);
    expect(await t.mutation(api.student.join, { code: joinCode, nickname: "Puma rápido" })).toMatchObject({ displayName: "Puma rápido" });
  });

  it("el alumno ve los retos de su clase (sin borradores) y cuáles ya resolvió", async () => {
    const { t, teacher, joinCode, classroomId } = await setup();
    const paseo = await teacher.mutation(api.assignments.create, { challengeId: "inicial-paseo", visibility: "class", classroomId });
    const gira = await teacher.mutation(api.assignments.create, { challengeId: "inicial-gira", visibility: "public", classroomId });
    await teacher.mutation(api.assignments.create, { challengeId: "inicial-charquito", visibility: "draft", classroomId });

    const { token } = await join(t, joinCode, "Pingüino veloz");
    let home = await t.query(api.student.home, { token });
    expect(home.classChallenges).toEqual([
      { assignmentId: paseo, challengeId: "inicial-paseo", title: "Primer paseo", level: "inicial", kind: "sequence", solved: false },
      { assignmentId: gira, challengeId: "inicial-gira", title: "Gira a la estrella", level: "inicial", kind: "sequence", solved: false },
    ]);

    expect(await playPaseo(t, token, [F])).toEqual({ solved: false });
    expect(await playPaseo(t, token, [F, F, F])).toEqual({ solved: true });
    home = await t.query(api.student.home, { token });
    expect(home.classChallenges.map((c) => [c.challengeId, c.solved])).toEqual([
      ["inicial-paseo", true],
      ["inicial-gira", false],
    ]);

    const classroom = await teacher.query(api.classrooms.get, { classroomId });
    expect(classroom.students).toMatchObject([
      { displayName: "Pingüino veloz", retosHechos: 1, retosTotal: 2, lastChallengeTitle: "Primer paseo", status: "in_progress" },
    ]);
  });

  it("recordChallengePlay verifica la partida en el servidor y suma al panel de impacto (partidas y personas)", async () => {
    const { t, joinCode } = await setup();
    const { token } = await join(t, joinCode, "Pingüino veloz");
    const zorro = await join(t, joinCode, "Zorro curioso");

    expect(await playPaseo(t, token, [F])).toEqual({ solved: false });
    expect(await playPaseo(t, token, [F, F, F], 1)).toEqual({ solved: true });
    expect(
      await t.mutation(api.student.recordChallengePlay, { token, challengeId: "primaria-donde", pick: { row: 1, col: 2 }, runs: 1, hints: 0, ms: 5000 }),
    ).toEqual({ solved: true });
    // Un programa mal formado cuenta como no resuelto, no rompe nada.
    expect(await playPaseo(t, token, [{ kind: "x" }])).toEqual({ solved: false });
    expect(await playPaseo(t, zorro.token, [F, F, F])).toEqual({ solved: true });

    const s = await t.query(api.impact.summary, {});
    expect(s.total).toMatchObject({ plays: 5, solved: 3, devices: 2, hintsHelped: 100 });
    expect(s.todayStats).toMatchObject({ plays: 5, solved: 3, devices: 2 });
    expect(JSON.stringify(s)).not.toContain("Pingüino");
    // Recalcular desde cero da lo mismo que contar sobre la marcha.
    expect(await t.mutation(internal.impact.rebuild, {})).toEqual(s.total);

    await expect(
      t.mutation(api.student.recordChallengePlay, { token: "falso", challengeId: "inicial-paseo", program: [F], runs: 1, hints: 0, ms: 1 }),
    ).rejects.toThrow(/sesión/);
    await expect(
      t.mutation(api.student.recordChallengePlay, { token, challengeId: "no-existe", program: [F], runs: 1, hints: 0, ms: 1 }),
    ).rejects.toThrow(/reto/);
  });

  it("una clase no admite alumnos sin límite: el código se comparte", async () => {
    const { t, joinCode, classroomId } = await setup();
    await t.run(async (ctx) => {
      for (let i = 0; i < MAX_STUDENTS_PER_CLASS; i++) await ctx.db.insert("students", { classroomId, displayName: `Alumno ${i}`, createdAt: Date.now() });
    });
    await expect(t.mutation(api.student.join, { code: joinCode, nickname: "Puma rápido" })).rejects.toThrow(/llena/);
  });

  it("frena a un alumno que envía demasiadas partidas seguidas", async () => {
    const { t, joinCode } = await setup();
    const { token } = await join(t, joinCode, "Pingüino veloz");
    for (let i = 0; i < 30; i++) await playPaseo(t, token, [F, F, F]);
    await expect(playPaseo(t, token, [F, F, F])).rejects.toThrow(/muchas/);
  });

  it("las funciones que ya usa otra web no cambian de forma: ambos modelos de alumno conviven", async () => {
    const { t, teacher, classroomId, joinCode } = await setup();
    // `classrooms.create` devuelve el Id, no un objeto.
    expect(typeof classroomId).toBe("string");
    const [ana] = await teacher.mutation(api.classrooms.addStudents, { classroomId, names: ["Ana"] });
    expect(ana).toEqual({ displayName: "Ana", accessCode: expect.stringMatching(/^[A-Z2-9]{6}$/) });
    await join(t, joinCode, "Pingüino veloz");

    const signedIn = await t.mutation(api.student.signIn, { code: ana!.accessCode });
    expect(signedIn).toEqual({ token: expect.any(String), displayName: "Ana" });
    if ("error" in signedIn) throw new Error(signedIn.error);
    expect(await t.query(api.student.home, { token: signedIn.token, today: "2026-10-17" })).toMatchObject({
      displayName: "Ana",
      level: "inicial",
      classroomLabel: "Inicial · 5 años · Sección A",
      today: "2026-10-17",
      evaluation: null,
      pendingCount: 0,
    });

    expect(await teacher.query(api.classrooms.listMine, {})).toMatchObject([
      { _id: classroomId, level: "inicial", grade: "5 años", section: "A", label: "Inicial · 5 años · Sección A", studentCount: 2 },
    ]);
    const classroom = await teacher.query(api.classrooms.get, { classroomId });
    expect(classroom).toMatchObject({ _id: classroomId, level: "inicial", label: "Inicial · 5 años · Sección A" });
    expect(classroom.students.map((s) => [s.displayName, s.accessCode])).toEqual([
      ["Ana", ana!.accessCode],
      ["Pingüino veloz", ""],
    ]);
  });

  it("a una clase vieja sin código se le asigna uno cuando el docente lo pide", async () => {
    const { t, teacher } = await setup();
    const teacherId = (await t.run((ctx) => ctx.db.query("users").first()))!._id;
    const oldId = await t.run((ctx) =>
      ctx.db.insert("classrooms", { teacherId, level: "primaria", grade: "3.º", section: "B", createdAt: Date.now() }),
    );
    expect(await teacher.query(api.classrooms.listMine, {})).toMatchObject([{ joinCode: expect.any(String) }, { _id: oldId, joinCode: null }]);
    expect(await teacher.mutation(api.classrooms.ensureJoinCodes, {})).toEqual({ assigned: 1 });
    expect(await teacher.mutation(api.classrooms.ensureJoinCodes, {})).toEqual({ assigned: 0 });
    const classes = await teacher.query(api.classrooms.listMine, {});
    expect(classes[1]!.joinCode).toMatch(/^[A-Z]{3}-[0-9]{3}$/);
    expect(classes[0]!.joinCode).not.toBe(classes[1]!.joinCode);
  });
});
