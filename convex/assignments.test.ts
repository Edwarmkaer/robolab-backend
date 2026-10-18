import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHALLENGES, challengeById } from "../domain/explore/challenges";
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

const NICKNAMES = ["Pingüino veloz", "Zorro curioso", "Cóndor azul", "Vicuña sabia", "Puma rápido"];
const RETO = "primaria-casa";
/** La ficha sale del dominio, para que un cambio de texto de un reto no rompa estas pruebas. */
const reto = challengeById(RETO)!;

async function setup() {
  const t = convexTest(schema, modules);
  const anaId = await t.run((ctx) => ctx.db.insert("users", { name: "Ana Pérez", email: "ana@colegio.pe" }));
  const luisId = await t.run((ctx) => ctx.db.insert("users", { name: "Luis", email: "luis@colegio.pe" }));
  const teacher = t.withIdentity({ subject: `${anaId}|s1` });
  const other = t.withIdentity({ subject: `${luisId}|s2` });
  const classroomId = await teacher.mutation(api.classrooms.create, { level: "primaria", grade: "5.º", section: "A" });
  const { joinCode } = await teacher.query(api.classrooms.get, { classroomId });
  const students: Record<string, Id<"students">> = {};
  for (const nickname of NICKNAMES) {
    const joined = await t.mutation(api.student.join, { code: joinCode!, nickname });
    if ("error" in joined) throw new Error(joined.error);
  }
  for (const s of (await teacher.query(api.classrooms.get, { classroomId })).students) {
    students[s.displayName] = s._id;
  }
  return { t, teacher, other, classroomId, students };
}

type Setup = Awaited<ReturnType<typeof setup>>;

/** Partida ya verificada, escrita directamente para controlar ejecuciones, pistas y tiempo. */
async function recordPlay(
  { t, classroomId, students }: Setup,
  nickname: string,
  facts: { solved: boolean; runs: number; hints: number; ms: number; at?: number },
  challengeId = RETO,
) {
  await t.run((ctx) =>
    ctx.db.insert("challengePlays", {
      studentId: students[nickname]!,
      classroomId,
      challengeId,
      solved: facts.solved,
      runs: facts.runs,
      hints: facts.hints,
      ms: facts.ms,
      createdAt: facts.at ?? Date.now(),
    }),
  );
}

describe("retos asignados a una clase", () => {
  it("el docente asigna un reto a su clase y lo ve con su ficha y sus resultados en cero", async () => {
    const s = await setup();
    const { teacher, classroomId } = s;
    const assignmentId = await teacher.mutation(api.assignments.create, { challengeId: RETO, visibility: "class", classroomId });

    expect(await teacher.query(api.assignments.listForClassroom, { classroomId })).toEqual([
      {
        assignmentId,
        challengeId: RETO,
        title: reto.title,
        topic: "tecnologia",
        level: "primaria",
        kind: "sequence",
        visibility: "class",
        solvedPercent: 0,
        studentsSolved: 0,
        studentCount: 5,
      },
    ]);

    const detail = await teacher.query(api.assignments.get, { assignmentId });
    expect(detail).toMatchObject({
      assignmentId,
      challengeId: RETO,
      title: reto.title,
      topic: "tecnologia",
      topicName: "Tecnología",
      level: "primaria",
      kind: "sequence",
      kindLabel: "Secuencia",
      difficulty: 1,
      visibility: "class",
      classroomId,
      classroomLabel: "Primaria · 5.º · Sección A",
    });
    expect(detail.map).toMatchObject({
      rows: reto.map.rows,
      cols: reto.map.cols,
      layout: reto.map.layout,
      start: reto.map.start,
      goal: reto.map.goal,
    });
    expect(detail.mission).toBeNull();
    expect(detail.story.length).toBeGreaterThan(0);
  });

  it("no asigna retos inexistentes, ni a clases ajenas, ni dos veces el mismo a la misma clase", async () => {
    const { teacher, other, classroomId } = await setup();
    await expect(teacher.mutation(api.assignments.create, { challengeId: "no-existe", visibility: "class", classroomId })).rejects.toThrow(/reto/);
    await expect(other.mutation(api.assignments.create, { challengeId: RETO, visibility: "class", classroomId })).rejects.toThrow(/No encontramos esa clase/);
    await teacher.mutation(api.assignments.create, { challengeId: RETO, visibility: "class", classroomId });
    await expect(teacher.mutation(api.assignments.create, { challengeId: RETO, visibility: "public", classroomId })).rejects.toThrow(/ya está en la clase/);
    expect(await other.query(api.assignments.listForClassroom, { classroomId }).catch((e: Error) => e.message)).toMatch(/No encontramos/);
  });

  it("un reto creado sin clase (T7) se asigna después; si ya tiene otra clase, se copia para la nueva", async () => {
    const { teacher, other, classroomId } = await setup();
    const assignmentId = await teacher.mutation(api.assignments.create, { challengeId: RETO, visibility: "draft" });
    expect(await teacher.query(api.assignments.get, { assignmentId })).toMatchObject({ classroomId: null, classroomLabel: null, visibility: "draft" });
    await expect(other.query(api.assignments.get, { assignmentId })).rejects.toThrow(/No encontramos/);

    expect(await teacher.mutation(api.assignments.assign, { assignmentId, classroomId })).toBe(assignmentId);
    // Al asignarlo deja de ser borrador: los alumnos lo ven.
    expect(await teacher.query(api.assignments.get, { assignmentId })).toMatchObject({ classroomId, visibility: "class" });
    expect(await teacher.query(api.assignments.listForClassroom, { classroomId })).toMatchObject([{ assignmentId }]);

    const second = await teacher.mutation(api.classrooms.create, { level: "primaria", grade: "5.º", section: "B" });
    const copy = await teacher.mutation(api.assignments.assign, { assignmentId, classroomId: second });
    expect(copy).not.toBe(assignmentId);
    expect(await teacher.query(api.assignments.listForClassroom, { classroomId: second })).toMatchObject([{ assignmentId: copy, challengeId: RETO }]);
    expect(await teacher.query(api.assignments.listForClassroom, { classroomId })).toMatchObject([{ assignmentId }]);
    // Volver a asignarlo a la misma clase no duplica.
    expect(await teacher.mutation(api.assignments.assign, { assignmentId, classroomId })).toBe(assignmentId);
    await expect(other.mutation(api.assignments.assign, { assignmentId, classroomId })).rejects.toThrow(/No encontramos/);
  });

  it("resultados del reto (T9): promedios, estados y lo observado", async () => {
    const s = await setup();
    const { teacher, classroomId } = s;
    const assignmentId = await teacher.mutation(api.assignments.create, { challengeId: RETO, visibility: "class", classroomId });
    // Las cifras de la maqueta: 80 % lo lograron, 2,0 intentos, 0,8 pistas, 4:12.
    await recordPlay(s, "Pingüino veloz", { solved: true, runs: 2, hints: 0, ms: 190_000 });
    await recordPlay(s, "Zorro curioso", { solved: true, runs: 3, hints: 2, ms: 400_000 });
    await recordPlay(s, "Cóndor azul", { solved: true, runs: 1, hints: 0, ms: 115_000 });
    await recordPlay(s, "Vicuña sabia", { solved: true, runs: 2, hints: 1, ms: 302_000 });
    // Una partida de otro reto no se mezcla.
    await recordPlay(s, "Puma rápido", { solved: true, runs: 1, hints: 0, ms: 1000 }, "primaria-charco");

    const results = await teacher.query(api.assignments.results, { assignmentId });
    expect(results).toMatchObject({
      title: reto.title,
      classroomLabel: "Primaria · 5.º · Sección A",
      topic: "tecnologia",
      level: "primaria",
      solvedPercent: 80,
      studentsSolved: 4,
      studentCount: 5,
      avgTries: 2,
      avgHints: 0.8,
      avgMs: 251_750,
      observed: { hintsUsed: 2, hintsTotal: 4, correctedAlone: 1, correctedTotal: 3 },
    });
    expect(results.rows.map((r) => [r.displayName, r.tries, r.hints, r.ms, r.status])).toEqual([
      ["Cóndor azul", 1, 0, 115_000, "solved"],
      ["Pingüino veloz", 2, 0, 190_000, "solved"],
      ["Puma rápido", 0, 0, 0, "not_started"],
      ["Vicuña sabia", 2, 1, 302_000, "solved"],
      ["Zorro curioso", 3, 2, 400_000, "solved"],
    ]);
    expect(results.rows[0]).toMatchObject({ studentId: s.students["Cóndor azul"] });

    expect(await teacher.query(api.assignments.listForClassroom, { classroomId })).toMatchObject([
      { assignmentId, solvedPercent: 80, studentsSolved: 4, studentCount: 5 },
    ]);
  });

  it("cuenta como «corrigió solo» a quien falló una partida entera y después resolvió sin pistas", async () => {
    const s = await setup();
    const { teacher, classroomId } = s;
    const assignmentId = await teacher.mutation(api.assignments.create, { challengeId: RETO, visibility: "class", classroomId });
    const now = Date.now();
    await recordPlay(s, "Pingüino veloz", { solved: false, runs: 2, hints: 0, ms: 60_000, at: now });
    await recordPlay(s, "Pingüino veloz", { solved: true, runs: 1, hints: 0, ms: 30_000, at: now + 1000 });
    await recordPlay(s, "Zorro curioso", { solved: false, runs: 1, hints: 1, ms: 20_000, at: now });
    await recordPlay(s, "Zorro curioso", { solved: true, runs: 2, hints: 0, ms: 50_000, at: now + 1000 });
    await recordPlay(s, "Cóndor azul", { solved: false, runs: 3, hints: 0, ms: 40_000, at: now });

    const results = await teacher.query(api.assignments.results, { assignmentId });
    expect(results).toMatchObject({
      solvedPercent: 40,
      avgTries: 3,
      observed: { hintsUsed: 1, hintsTotal: 3, correctedAlone: 1, correctedTotal: 3 },
    });
    expect(results.rows.map((r) => [r.displayName, r.tries, r.hints, r.ms, r.status])).toEqual([
      ["Cóndor azul", 3, 0, 40_000, "in_progress"],
      ["Pingüino veloz", 3, 0, 30_000, "solved"],
      ["Puma rápido", 0, 0, 0, "not_started"],
      ["Vicuña sabia", 0, 0, 0, "not_started"],
      ["Zorro curioso", 3, 1, 50_000, "solved"],
    ]);
    // El avance por alumno de la clase (T8) sale de las mismas partidas.
    const classroom = await teacher.query(api.classrooms.get, { classroomId });
    expect(classroom.students.map((x) => [x.displayName, x.retosHechos, x.retosTotal, x.lastChallengeTitle, x.status])).toEqual([
      ["Cóndor azul", 0, 1, reto.title, "in_progress"],
      ["Pingüino veloz", 1, 1, reto.title, "solved"],
      ["Puma rápido", 0, 1, null, "not_started"],
      ["Vicuña sabia", 0, 1, null, "not_started"],
      ["Zorro curioso", 1, 1, reto.title, "solved"],
    ]);
  });

  it("los resultados son solo de retos con clase y del propio docente", async () => {
    const { teacher, other } = await setup();
    const loose = await teacher.mutation(api.assignments.create, { challengeId: RETO, visibility: "public" });
    await expect(teacher.query(api.assignments.results, { assignmentId: loose })).rejects.toThrow(/no está asignado/);
    await expect(other.query(api.assignments.results, { assignmentId: loose })).rejects.toThrow(/No encontramos/);
  });

  it("available lista todos los retos del dominio para elegir (T2, T4)", async () => {
    const { teacher, t } = await setup();
    const available = await teacher.query(api.assignments.available, {});
    expect(available.length).toBeGreaterThanOrEqual(CHALLENGES.length);
    expect(available).toContainEqual({
      challengeId: "inicial-paseo",
      title: "Primer paseo",
      topic: "tecnologia",
      topicName: "Tecnología",
      level: "inicial",
      kind: "sequence",
      kindLabel: "Secuencia",
      difficulty: 1,
      emoji: "🚶",
    });
    expect(new Set(available.map((a) => a.challengeId)).size).toBe(available.length);
    await expect(t.query(api.assignments.available, {})).rejects.toThrow(/Inicia sesión/);
  });
});
