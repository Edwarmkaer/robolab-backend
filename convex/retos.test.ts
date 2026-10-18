import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { modules } from "./test.setup";

const STEP = 60_000; // entre un reto y otro: ordena sin caducar la sesión del alumno
const T0 = Date.UTC(2026, 9, 17, 20, 0);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
});

afterEach(() => {
  vi.useRealTimers();
});

const NICKNAMES = ["Pingüino veloz", "Zorro curioso", "Cóndor azul"];
const PASEO = "inicial-paseo";
const GIRA = "inicial-gira";
const CHARQUITO = "inicial-charquito";

async function setup() {
  const t = convexTest(schema, modules);
  const anaId = await t.run((ctx) => ctx.db.insert("users", { name: "Ana Pérez", email: "ana@colegio.pe" }));
  const luisId = await t.run((ctx) => ctx.db.insert("users", { name: "Luis", email: "luis@colegio.pe" }));
  const teacher = t.withIdentity({ subject: `${anaId}|s1` });
  const other = t.withIdentity({ subject: `${luisId}|s2` });
  const classA = await teacher.mutation(api.classrooms.create, { level: "inicial", grade: "5 años", section: "A" });
  const classB = await teacher.mutation(api.classrooms.create, { level: "primaria", grade: "3.º", section: "B" });
  const { joinCode } = await teacher.query(api.classrooms.get, { classroomId: classA });
  const tokens: Record<string, string> = {};
  for (const nickname of NICKNAMES) {
    const joined = await t.mutation(api.student.join, { code: joinCode!, nickname });
    if ("error" in joined) throw new Error(joined.error);
    tokens[nickname] = joined.token;
  }
  const students: Record<string, Id<"students">> = {};
  for (const s of (await teacher.query(api.classrooms.get, { classroomId: classA })).students) students[s.displayName] = s._id;
  return { t, teacher, other, classA, classB, students, tokens };
}
type Setup = Awaited<ReturnType<typeof setup>>;

/** Cada reto se crea un minuto después del anterior, para que el orden de asignación sea claro. */
async function assignNext(teacher: Setup["teacher"], challengeId: string, classroomId?: Id<"classrooms">) {
  vi.setSystemTime(Date.now() + STEP);
  return await teacher.mutation(api.assignments.create, {
    challengeId,
    visibility: classroomId ? "class" : "draft",
    ...(classroomId ? { classroomId } : {}),
  });
}

async function play(s: Setup, nickname: string, challengeId: string, facts: { solved: boolean; runs: number; hints?: number; ms?: number }) {
  await s.t.run((ctx) =>
    ctx.db.insert("challengePlays", {
      studentId: s.students[nickname]!,
      classroomId: s.classA,
      challengeId,
      solved: facts.solved,
      runs: facts.runs,
      hints: facts.hints ?? 0,
      ms: facts.ms ?? 60_000,
      createdAt: Date.now(),
    }),
  );
  vi.setSystemTime(Date.now() + 1000);
}

describe("Retos del docente: todos sus retos en una lista", () => {
  it("lista los retos de todas sus clases y los sueltos, el más nuevo primero, con lo que lograron", async () => {
    const s = await setup();
    await assignNext(s.teacher, PASEO, s.classA);
    await assignNext(s.teacher, GIRA); // suelto: aún sin clase
    await assignNext(s.teacher, CHARQUITO, s.classB);
    await play(s, "Pingüino veloz", PASEO, { solved: true, runs: 2 });
    await play(s, "Zorro curioso", PASEO, { solved: true, runs: 3 });
    await play(s, "Cóndor azul", PASEO, { solved: false, runs: 4 });

    const list = await s.teacher.query(api.assignments.listMine, {});
    expect(list.map((r) => r.challengeId)).toEqual([CHARQUITO, GIRA, PASEO]);
    expect(list[2]).toMatchObject({
      challengeId: PASEO,
      title: "Primer paseo",
      topic: "tecnologia",
      topicName: "Tecnología",
      level: "inicial",
      kind: "sequence",
      emoji: "🚶",
      visibility: "class",
      classroomId: s.classA,
      classroomLabel: "Inicial · 5 años · Sección A",
      closed: false,
      studentCount: 3,
      studentsSolved: 2,
      solvedPercent: 67,
    });
    // Un reto suelto no tiene clase ni cifras inventadas.
    expect(list[1]).toMatchObject({ visibility: "draft", classroomId: null, classroomLabel: null, studentCount: 0, studentsSolved: 0, solvedPercent: 0, closed: false });
    // Una clase sin alumnos tampoco: 0 de 0 es 0 %.
    expect(list[0]).toMatchObject({ classroomId: s.classB, studentCount: 0, solvedPercent: 0 });
  });

  it("solo ve los suyos y pide sesión de docente", async () => {
    const s = await setup();
    await assignNext(s.teacher, PASEO, s.classA);
    expect(await s.other.query(api.assignments.listMine, {})).toEqual([]);
    await expect(s.t.query(api.assignments.listMine, {})).rejects.toThrow(/Inicia sesión/);
  });
});

describe("Cerrar y reabrir un reto", () => {
  it("al cerrarlo sale de lo que ve el alumno y de los retos pendientes de la clase; al reabrirlo vuelve", async () => {
    const s = await setup();
    const paseo = await assignNext(s.teacher, PASEO, s.classA);
    await assignNext(s.teacher, GIRA, s.classA);
    const token = s.tokens["Pingüino veloz"]!;

    expect((await s.t.query(api.student.home, { token })).classChallenges.map((c) => c.challengeId)).toEqual([PASEO, GIRA]);

    await s.teacher.mutation(api.assignments.close, { assignmentId: paseo });
    expect((await s.t.query(api.student.home, { token })).classChallenges.map((c) => c.challengeId)).toEqual([GIRA]);
    expect((await s.teacher.query(api.classrooms.get, { classroomId: s.classA })).students[0]!.retosTotal).toBe(1);
    expect((await s.teacher.query(api.assignments.listMine, {})).find((r) => r.assignmentId === paseo)).toMatchObject({ closed: true });

    await s.teacher.mutation(api.assignments.reopen, { assignmentId: paseo });
    expect((await s.t.query(api.student.home, { token })).classChallenges.map((c) => c.challengeId)).toEqual([PASEO, GIRA]);
    expect((await s.teacher.query(api.assignments.listMine, {})).find((r) => r.assignmentId === paseo)).toMatchObject({ closed: false });
  });

  it("un reto cerrado conserva sus resultados", async () => {
    const s = await setup();
    const paseo = await assignNext(s.teacher, PASEO, s.classA);
    await play(s, "Pingüino veloz", PASEO, { solved: true, runs: 2 });
    await s.teacher.mutation(api.assignments.close, { assignmentId: paseo });
    expect(await s.teacher.query(api.assignments.results, { assignmentId: paseo })).toMatchObject({ studentsSolved: 1 });
  });

  it("solo el dueño lo cierra o lo reabre, y repetirlo no falla", async () => {
    const s = await setup();
    const paseo = await assignNext(s.teacher, PASEO, s.classA);
    await expect(s.other.mutation(api.assignments.close, { assignmentId: paseo })).rejects.toThrow(/No encontramos/);
    await expect(s.other.mutation(api.assignments.reopen, { assignmentId: paseo })).rejects.toThrow(/No encontramos/);
    await s.teacher.mutation(api.assignments.close, { assignmentId: paseo });
    await s.teacher.mutation(api.assignments.close, { assignmentId: paseo });
    await s.teacher.mutation(api.assignments.reopen, { assignmentId: paseo });
    await s.teacher.mutation(api.assignments.reopen, { assignmentId: paseo });
  });
});

describe("Progreso de la clase reto por reto", () => {
  it("devuelve una columna por reto asignado (en orden), una fila por alumno y los avisos observables", async () => {
    const s = await setup();
    await assignNext(s.teacher, PASEO, s.classA);
    await assignNext(s.teacher, GIRA, s.classA);
    await assignNext(s.teacher, CHARQUITO, s.classA);
    await play(s, "Pingüino veloz", PASEO, { solved: true, runs: 2, hints: 1, ms: 90_000 });
    await play(s, "Pingüino veloz", GIRA, { solved: true, runs: 3 });
    await play(s, "Zorro curioso", PASEO, { solved: false, runs: 5 });
    await play(s, "Zorro curioso", GIRA, { solved: false, runs: 6 });

    const progress = await s.teacher.query(api.analytics.classRetosProgress, { classroomId: s.classA });
    expect(progress.classroomLabel).toBe("Inicial · 5 años · Sección A");
    expect(progress.retos.map((r) => [r.challengeId, r.title, r.solvedPercent, r.playedCount, r.closed])).toEqual([
      [PASEO, "Primer paseo", 33, 2, false],
      [GIRA, "Gira a la estrella", 33, 2, false],
      [CHARQUITO, "El charquito", 0, 0, false],
    ]);
    expect(progress.students.map((x) => x.displayName)).toEqual(["Cóndor azul", "Pingüino veloz", "Zorro curioso"]);
    const pinguino = progress.students[1]!;
    expect(pinguino.studentId).toBe(s.students["Pingüino veloz"]);
    expect(pinguino.cells[0]).toEqual({ challengeId: PASEO, status: "solved", tries: 2, hints: 1, ms: 90_000 });
    expect(pinguino.cells[2]).toEqual({ challengeId: CHARQUITO, status: "not_started", tries: null, hints: null, ms: null });
    expect(progress.attention).toContainEqual({ studentId: s.students["Zorro curioso"], displayName: "Zorro curioso", kind: "unsolved_streak", count: 2 });
    expect(progress.attention).toContainEqual({ studentId: s.students["Cóndor azul"], displayName: "Cóndor azul", kind: "not_started", count: 3 });
  });

  it("no cuenta los borradores y sí los retos cerrados (son parte de lo que ya se aprendió)", async () => {
    const s = await setup();
    const paseo = await assignNext(s.teacher, PASEO, s.classA);
    vi.setSystemTime(Date.now() + STEP);
    await s.teacher.mutation(api.assignments.create, { challengeId: GIRA, visibility: "draft", classroomId: s.classA });
    await s.teacher.mutation(api.assignments.close, { assignmentId: paseo });
    const progress = await s.teacher.query(api.analytics.classRetosProgress, { classroomId: s.classA });
    expect(progress.retos.map((r) => [r.challengeId, r.closed])).toEqual([[PASEO, true]]);
  });

  it("una clase sin retos devuelve listas vacías con sus alumnos", async () => {
    const s = await setup();
    const progress = await s.teacher.query(api.analytics.classRetosProgress, { classroomId: s.classA });
    expect(progress.retos).toEqual([]);
    expect(progress.attention).toEqual([]);
    expect(progress.students).toHaveLength(3);
    expect(progress.students[0]!.cells).toEqual([]);
  });

  it("solo la dueña de la clase lo consulta", async () => {
    const s = await setup();
    await expect(s.other.query(api.analytics.classRetosProgress, { classroomId: s.classA })).rejects.toThrow(/No encontramos esa clase/);
    await expect(s.t.query(api.analytics.classRetosProgress, { classroomId: s.classA })).rejects.toThrow(/Inicia sesión/);
  });
});

describe("Inicio del docente: retos activos", () => {
  it("trae los retos abiertos de sus clases, el más nuevo primero y como mucho cuatro, sin borradores ni cerrados", async () => {
    const s = await setup();
    const paseo = await assignNext(s.teacher, PASEO, s.classA);
    await assignNext(s.teacher, GIRA, s.classA);
    await assignNext(s.teacher, CHARQUITO, s.classA);
    await assignNext(s.teacher, "inicial-donde", s.classA);
    await assignNext(s.teacher, "inicial-arregla", s.classA);
    await assignNext(s.teacher, "inicial-tecnologia-parada", s.classB);
    vi.setSystemTime(Date.now() + STEP);
    await s.teacher.mutation(api.assignments.create, { challengeId: "inicial-ciencia-probeta", visibility: "draft" });
    await s.teacher.mutation(api.assignments.close, { assignmentId: paseo });
    await play(s, "Pingüino veloz", GIRA, { solved: true, runs: 2 });

    const home = await s.teacher.query(api.teacherHome.home, {});
    expect(home.activeRetos).toHaveLength(4);
    expect(home.activeRetos.map((r) => r.challengeId)).toEqual(["inicial-tecnologia-parada", "inicial-arregla", "inicial-donde", CHARQUITO]);
    expect(home.activeRetos[0]).toMatchObject({ classroomLabel: "Primaria · 3.º · Sección B", studentCount: 0, studentsSolved: 0, solvedPercent: 0 });
    const gira = (await s.teacher.query(api.teacherHome.home, {})).activeRetos.find((r) => r.challengeId === GIRA);
    expect(gira).toBeUndefined(); // quedó fuera del top cuatro
  });

  it("muestra cuántos de la clase ya lo lograron", async () => {
    const s = await setup();
    await assignNext(s.teacher, GIRA, s.classA);
    await play(s, "Pingüino veloz", GIRA, { solved: true, runs: 2 });
    await play(s, "Zorro curioso", GIRA, { solved: true, runs: 3 });
    const home = await s.teacher.query(api.teacherHome.home, {});
    expect(home.activeRetos).toEqual([
      expect.objectContaining({ challengeId: GIRA, title: "Gira a la estrella", classroomLabel: "Inicial · 5 años · Sección A", studentCount: 3, studentsSolved: 2, solvedPercent: 67 }),
    ]);
  });
});
