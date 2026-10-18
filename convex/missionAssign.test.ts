import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MISSIONS, missionById } from "../domain/lab/mission";
import { solve } from "../domain/lab/solve";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(Date.UTC(2026, 9, 17, 20, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

const MISSION = missionById("primaria-tecnologia-materiales")!;
const arrowsFor = (level: number) => [...solve(MISSION, level)!.path];

async function setup() {
  const t = convexTest(schema, modules);
  const teacherId = await t.run((ctx) => ctx.db.insert("users", { name: "Ana Pérez", email: "ana@colegio.pe" }));
  const teacher = t.withIdentity({ subject: `${teacherId}|s1` });
  const classroomId = await teacher.mutation(api.classrooms.create, { level: "primaria", grade: "3.º", section: "A" });
  const { joinCode } = await teacher.query(api.classrooms.get, { classroomId });
  const joined = await t.mutation(api.student.join, { code: joinCode!, nickname: "Pingüino veloz" });
  if ("error" in joined) throw new Error(joined.error);
  return { t, teacher, classroomId, token: joined.token };
}

describe("misiones de Primaria como retos de clase", () => {
  it("el docente las ve entre los retos disponibles, con tipo «mission»", async () => {
    const { teacher } = await setup();
    const available = await teacher.query(api.assignments.available, {});
    const missions = available.filter((a) => a.kind === "mission");
    expect(missions.map((m) => m.challengeId).sort()).toEqual(MISSIONS.map((m) => m.id).sort());
    expect(missions).toContainEqual({
      challengeId: MISSION.id,
      title: MISSION.title,
      topic: "tecnologia",
      topicName: "Tecnología",
      level: "primaria",
      kind: "mission",
      kindLabel: "Misión",
      difficulty: 3,
      emoji: MISSION.emoji,
    });
    expect(new Set(available.map((a) => a.challengeId)).size).toBe(available.length);
  });

  it("al asignar una misión, el docente recibe su ficha con el tablero y el alumno la ve entre los retos de su clase", async () => {
    const { t, teacher, classroomId, token } = await setup();
    const assignmentId = await teacher.mutation(api.assignments.create, { challengeId: MISSION.id, visibility: "class", classroomId });

    const detail = await teacher.query(api.assignments.get, { assignmentId });
    expect(detail).toMatchObject({ challengeId: MISSION.id, kind: "mission", kindLabel: "Misión", level: "primaria", map: null });
    expect(detail.mission).toMatchObject({ id: MISSION.id, size: 6, start: MISSION.start, goal: MISSION.goal });
    expect(detail.mission?.levels).toHaveLength(3);

    expect((await t.query(api.student.home, { token })).classChallenges).toEqual([
      { assignmentId, challengeId: MISSION.id, title: MISSION.title, level: "primaria", kind: "mission", solved: false },
    ]);
  });

  it("el servidor vuelve a ejecutar las flechas en el subnivel que jugó el alumno", async () => {
    const { t, teacher, classroomId, token } = await setup();
    await teacher.mutation(api.assignments.create, { challengeId: MISSION.id, visibility: "class", classroomId });
    const play = (arrows: string[], level: number) =>
      t.mutation(api.student.recordChallengePlay, { token, challengeId: MISSION.id, arrows, level, runs: 2, hints: 1, ms: 40_000 });

    // Una ruta que no llega a la meta no resuelve, y la que visita una sola estación sirve en 2.º pero no en 3.º.
    expect(await play(arrowsFor(1).slice(0, 5), 1)).toEqual({ solved: false });
    expect(await play(arrowsFor(0), 1)).toEqual({ solved: false });
    expect(await play(arrowsFor(0), 0)).toEqual({ solved: true });
    // Flechas mal formadas cuentan como no resuelto, no rompen nada.
    expect(await play(["X"], 0)).toEqual({ solved: false });
    expect(await play(Array.from({ length: 81 }, () => "U"), 0)).toEqual({ solved: false });
    // Un subnivel que no existe se rechaza.
    await expect(play(arrowsFor(0), 3)).rejects.toThrow(/nivel/);
    await expect(play(arrowsFor(0), 1.5)).rejects.toThrow(/nivel/);

    const home = await t.query(api.student.home, { token });
    expect(home.classChallenges.map((c) => [c.challengeId, c.solved])).toEqual([[MISSION.id, true]]);

    const results = await teacher.query(api.assignments.results, {
      assignmentId: (await teacher.query(api.assignments.listForClassroom, { classroomId }))[0]!.assignmentId,
    });
    expect(results).toMatchObject({ kind: "mission", solvedPercent: 100, studentCount: 1 });
    expect(results.rows).toMatchObject([{ displayName: "Pingüino veloz", status: "solved", hints: 3 }]);
  });

  it("la misión resuelta suma al panel de impacto, sin nombres", async () => {
    const { t, token } = await setup();
    await t.mutation(api.student.recordChallengePlay, { token, challengeId: MISSION.id, arrows: arrowsFor(2), level: 2, runs: 3, hints: 0, ms: 60_000 });
    const s = await t.query(api.impact.summary, {});
    expect(s.total).toMatchObject({ plays: 1, solved: 1, devices: 1, avgRunsToSolve: 3, avgMinutesToSolve: 1 });
    expect(JSON.stringify(s)).not.toContain("Pingüino");
  });

  it("el modo abierto de bloques no acepta misiones: esas se anotan con lab.recordPlay", async () => {
    const { t } = await setup();
    await expect(
      t.mutation(api.explore.recordPlay, { deviceId: "b".repeat(32), challengeId: MISSION.id, runs: 1, hints: 0, ms: 1000 }),
    ).rejects.toThrow(/reto/);
  });
});
