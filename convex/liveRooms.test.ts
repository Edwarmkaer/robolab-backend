import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Command } from "../domain/game/program";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

const SOLUTION: Command[] = ["FORWARD", "FORWARD", "TURN_RIGHT", "FORWARD", "FORWARD", "TURN_LEFT", "FORWARD", "FORWARD"];
beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(1800000000000); });
afterEach(() => { vi.useRealTimers(); });
async function setup(mode: "race" | "cooperative" = "race") {
  const t = convexTest(schema, modules);
  const uid = await t.run((ctx) => ctx.db.insert("users", { name: "Ana" }));
  const oid = await t.run((ctx) => ctx.db.insert("users", { name: "Luis" }));
  const teacher = t.withIdentity({ subject: `${uid}|s` });
  const other = t.withIdentity({ subject: `${oid}|s` });
  const classroomId = await teacher.mutation(api.classrooms.create, { level: "primaria", grade: "3", section: "A" });
  const c = await teacher.query(api.classrooms.get, { classroomId });
  const tokens: string[] = [];
  for (const nickname of ["Pingüino veloz", "Zorro curioso", "Cóndor azul"]) {
    const result = await t.mutation(api.student.join, { code: c.joinCode!, nickname });
    if ("error" in result) throw new Error(result.error);
    tokens.push(result.token);
  }
  const roomId = await teacher.mutation(api.liveRooms.create, { classroomId, mazeId: "jardin", mode });
  const [a, b, late] = tokens as [string, string, string];
  await t.mutation(api.liveRooms.join, { token: a, roomId });
  await t.mutation(api.liveRooms.join, { token: b, roomId });
  return { t, teacher, other, classroomId, roomId, a, b, late };
}

describe("retos en vivo", () => {
  it("limita cada sala a 100 participantes y las listas a las 30 salas más recientes", async () => {
    const { t, teacher, classroomId, roomId, late, a } = await setup();
    for (let i = 0; i < 98; i++) {
      const token = `extra-${i}`;
      await t.run(async (ctx) => {
        const studentId = await ctx.db.insert("students", { classroomId, displayName: `Alumno ${i}`, createdAt: Date.now() });
        await ctx.db.insert("studentSessions", { studentId, token, expiresAt: Date.now() + 3600000 });
      });
      await t.mutation(api.liveRooms.join, { token, roomId });
    }
    await expect(t.mutation(api.liveRooms.join, { token: late, roomId })).rejects.toThrow(/100/);
    await t.mutation(api.liveRooms.join, { token: a, roomId });
    expect((await teacher.query(api.liveRooms.teacherView, { roomId })).participants).toHaveLength(100);
    let newest = roomId;
    for (let i = 0; i < 31; i++) newest = await teacher.mutation(api.liveRooms.create, { classroomId, mazeId: "sendero", mode: "race" });
    const mine = await teacher.query(api.liveRooms.listMine, {});
    const available = await t.query(api.liveRooms.listForStudent, { token: a });
    expect(mine).toHaveLength(30);
    expect(available).toHaveLength(30);
    expect(mine[0]!.roomId).toBe(newest);
    expect(available.some((r) => r.roomId === roomId)).toBe(false);
  });

  it("no inicia una sala vacía", async () => {
    const { teacher, classroomId } = await setup();
    const empty = await teacher.mutation(api.liveRooms.create, { classroomId, mazeId: "jardin", mode: "race" });
    await expect(teacher.mutation(api.liveRooms.setStatus, { roomId: empty, status: "running" })).rejects.toThrow(/participante/);
    expect(await teacher.query(api.liveRooms.teacherView, { roomId: empty })).toMatchObject({ status: "waiting", startedAt: null });
  });

  it("limpia historiales grandes por lotes y las listas siguen disponibles mientras se borra", async () => {
    vi.useFakeTimers();
    const { t, teacher, classroomId, roomId, a } = await setup();
    const own = await t.query(api.liveRooms.studentView, { token: a, roomId });
    await t.run(async (ctx) => {
      for (let i = 0; i < 205; i++) await ctx.db.insert("liveRunRequests", { classroomId, roomId, studentId: own.me!.studentId, requestId: String(i) });
    });
    await teacher.mutation(api.classrooms.remove, { classroomId });
    expect(await teacher.query(api.liveRooms.listMine, {})).toEqual([]);
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(await t.run(async (ctx) => Promise.all([ctx.db.query("liveRooms").collect(), ctx.db.query("liveParticipants").collect(), ctx.db.query("liveRunRequests").collect()]))).toEqual([[], [], []]);
  });

  it("espera, inicia y asigna llegadas únicas incluso con reloj fijo y envíos concurrentes", async () => {
    const { t, teacher, roomId, a, b } = await setup();
    expect(await teacher.query(api.liveRooms.teacherView, { roomId })).toMatchObject({ status: "waiting", participants: [{ runs: 0 }, { runs: 0 }], me: null });
    expect(await t.query(api.liveRooms.listForStudent, { token: a })).toMatchObject([{ roomId, participantCount: 2 }]);
    await teacher.mutation(api.liveRooms.setStatus, { roomId, status: "running" });
    await Promise.all([a, b].map((token) => t.mutation(api.liveRooms.run, { token, roomId, program: SOLUTION, requestId: token })));
    const view = await teacher.query(api.liveRooms.teacherView, { roomId });
    expect(view.status).toBe("running");
    expect(view.participants.map((p) => p.place).sort()).toEqual([1, 2]);
    expect(view.participants.map((p) => p.finishedAt)).toEqual([Date.now(), Date.now()]);
    expect(view.participants.every((p) => p.runs === 1 && p.outcome === "GOAL")).toBe(true);
    await expect(t.mutation(api.liveRooms.run, { token: a, roomId, program: [], requestId: "after-goal" })).rejects.toThrow(/resuelto/);
    expect(await teacher.query(api.liveRooms.listMine, {})).toMatchObject([{ roomId, participantCount: 2 }]);
  });

  it("rechaza ejecutar en espera o cerrado, y nuevos alumnos tras iniciar; conserva reingresos", async () => {
    const { t, teacher, roomId, a, late } = await setup();
    await expect(t.mutation(api.liveRooms.run, { token: a, roomId, program: SOLUTION, requestId: "wait" })).rejects.toThrow(/iniciado/);
    await expect(t.mutation(api.liveRooms.editShared, { token: a, roomId, revision: 0, action: "clear" })).rejects.toThrow();
    await teacher.mutation(api.liveRooms.setStatus, { roomId, status: "running" });
    await expect(t.mutation(api.liveRooms.join, { token: late, roomId })).rejects.toThrow(/iniciado/);
    await expect(t.mutation(api.liveRooms.join, { token: a, roomId })).resolves.toBeNull();
    await expect(t.mutation(api.liveRooms.run, { token: late, roomId, program: SOLUTION, requestId: "late" })).rejects.toThrow(/unirte/);
    await teacher.mutation(api.liveRooms.setStatus, { roomId, status: "closed" });
    await expect(t.mutation(api.liveRooms.run, { token: a, roomId, program: SOLUTION, requestId: "closed" })).rejects.toThrow(/cerrad/);
    await expect(t.mutation(api.liveRooms.join, { token: a, roomId })).resolves.toBeNull();
    await expect(teacher.mutation(api.liveRooms.setStatus, { roomId, status: "running" })).rejects.toThrow(/cerrad/);
    expect(await t.query(api.liveRooms.listForStudent, { token: a })).toMatchObject([{ status: "closed" }]);
  });

  it("solo permite a la clase y al docente dueño; rechaza sesiones inexistentes o vencidas", async () => {
    const { t, teacher, other, classroomId, roomId, a } = await setup();
    await expect(t.query(api.liveRooms.teacherView, { roomId })).rejects.toThrow(/Inicia sesión/);
    await expect(other.query(api.liveRooms.teacherView, { roomId })).rejects.toThrow(/No encontramos/);
    await expect(other.mutation(api.liveRooms.setStatus, { roomId, status: "running" })).rejects.toThrow(/No encontramos/);
    await expect(other.mutation(api.liveRooms.create, { classroomId, mazeId: "jardin", mode: "race" })).rejects.toThrow(/No encontramos/);
    await expect(teacher.mutation(api.liveRooms.create, { classroomId, mazeId: "falso", mode: "race" })).rejects.toThrow(/laberinto/);
    const otherClass = await other.mutation(api.classrooms.create, { level: "primaria", grade: "2", section: "A" });
    const c = await other.query(api.classrooms.get, { classroomId: otherClass });
    const stranger = await t.mutation(api.student.join, { code: c.joinCode!, nickname: "Pingüino veloz" });
    if ("error" in stranger) throw new Error(stranger.error);
    for (const token of ["missing", stranger.token]) {
      await expect(t.query(api.liveRooms.studentView, { token, roomId })).rejects.toThrow();
      await expect(t.mutation(api.liveRooms.join, { token, roomId })).rejects.toThrow();
    }
    expect(await t.query(api.liveRooms.listForStudent, { token: stranger.token })).toEqual([]);
    vi.setSystemTime(Date.now() + 366 * 86400000);
    await expect(t.query(api.liveRooms.studentView, { token: a, roomId })).rejects.toThrow(/sesión/);
  });

  it("simula desde el inicio, conserva el programa propio y no filtra programas rivales", async () => {
    const { t, teacher, roomId, a, b } = await setup();
    await teacher.mutation(api.liveRooms.setStatus, { roomId, status: "running" });
    await t.mutation(api.liveRooms.run, { token: a, roomId, program: ["BACKWARD"], requestId: "off" });
    const own = await t.query(api.liveRooms.studentView, { token: a, roomId });
    expect(own.me).toMatchObject({ program: ["BACKWARD"], runs: 1, outcome: "OFF_PATH", finishedAt: null, state: { cell: { row: 4, col: 0 }, heading: 0 } });
    const rival = await t.query(api.liveRooms.studentView, { token: b, roomId });
    expect(rival.participants.some((p) => "program" in p || "state" in p)).toBe(false);
    expect(rival.shared.program).toEqual([]);
    expect(rival.me?.program).toEqual([]);
    await expect(t.mutation(api.liveRooms.run, { token: a, roomId, program: Array(61).fill("FORWARD"), requestId: "big" })).rejects.toThrow(/60/);
    await expect(t.mutation(api.liveRooms.run, { token: a, roomId, program: ["GOAL"] as unknown as Command[], requestId: "fake" })).rejects.toThrow();
    await expect(t.mutation(api.liveRooms.run, { token: a, roomId, program: [], requestId: "" })).rejects.toThrow(/solicitud/);
    vi.setSystemTime(Date.now() + 300);
    await t.mutation(api.liveRooms.run, { token: a, roomId, program: [], requestId: "empty" });
    expect((await t.query(api.liveRooms.studentView, { token: a, roomId })).me).toMatchObject({ outcome: "EMPTY", runs: 2 });
    vi.setSystemTime(Date.now() + 300);
    await t.mutation(api.liveRooms.run, { token: a, roomId, program: SOLUTION, requestId: "solve" });
    expect((await t.query(api.liveRooms.studentView, { token: a, roomId })).me).toMatchObject({ outcome: "GOAL", runs: 3 });
  });

  it("los reenvíos viejos y concurrentes no duplican ejecuciones ni puestos; frena nuevos envíos inmediatos", async () => {
    const { t, teacher, roomId, a } = await setup();
    await teacher.mutation(api.liveRooms.setStatus, { roomId, status: "running" });
    await Promise.all([1, 2].map(() => t.mutation(api.liveRooms.run, { token: a, roomId, program: [], requestId: "one" })));
    await expect(t.mutation(api.liveRooms.run, { token: a, roomId, program: [], requestId: "too-fast" })).rejects.toThrow(/Espera/);
    vi.setSystemTime(Date.now() + 300);
    await t.mutation(api.liveRooms.run, { token: a, roomId, program: ["FORWARD"], requestId: "two" });
    await t.mutation(api.liveRooms.run, { token: a, roomId, program: [], requestId: "one" });
    vi.setSystemTime(Date.now() + 300);
    await t.mutation(api.liveRooms.run, { token: a, roomId, program: SOLUTION, requestId: "three" });
    await teacher.mutation(api.liveRooms.setStatus, { roomId, status: "closed" });
    await t.mutation(api.liveRooms.run, { token: a, roomId, program: SOLUTION, requestId: "three" });
    expect((await t.query(api.liveRooms.studentView, { token: a, roomId })).me).toMatchObject({ runs: 3, outcome: "GOAL" });
  });

  it("edita programa compartido con revisión y ejecuta solo la versión del servidor", async () => {
    const { t, teacher, roomId, a, b } = await setup("cooperative");
    await teacher.mutation(api.liveRooms.setStatus, { roomId, status: "running" });
    const edits = await Promise.allSettled([a, b].map((token) => t.mutation(api.liveRooms.editShared, { token, roomId, revision: 0, action: "append", command: "FORWARD" })));
    expect(edits.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    await expect(t.mutation(api.liveRooms.run, { token: a, roomId, program: SOLUTION, revision: 0, requestId: "stale" })).rejects.toThrow(/cambió/);
    await expect(t.mutation(api.liveRooms.run, { token: a, roomId, program: SOLUTION, revision: 1, requestId: "fake" })).rejects.toThrow(/compartido/);
    await t.mutation(api.liveRooms.run, { token: a, roomId, revision: 1, requestId: "first" });
    expect((await t.query(api.liveRooms.studentView, { token: b, roomId })).shared).toMatchObject({ program: ["FORWARD"], runs: 1, outcome: "INCOMPLETE", state: { cell: { row: 3, col: 0 } } });
    for (const [i, command] of SOLUTION.slice(1).entries()) {
      await t.mutation(api.liveRooms.editShared, { token: b, roomId, revision: i + 1, action: "append", command });
    }
    await t.mutation(api.liveRooms.run, { token: b, roomId, revision: 8, requestId: "solution" });
    expect((await teacher.query(api.liveRooms.teacherView, { roomId })).shared).toMatchObject({ outcome: "GOAL", runs: 2 });
    await expect(t.mutation(api.liveRooms.editShared, { token: a, roomId, revision: 8, action: "clear" })).rejects.toThrow(/resuelto/);
    await expect(t.mutation(api.liveRooms.run, { token: b, roomId, revision: 8, requestId: "new" })).rejects.toThrow(/resuelto/);
    await t.mutation(api.liveRooms.run, { token: a, roomId, revision: 1, requestId: "first" });
    expect((await teacher.query(api.liveRooms.teacherView, { roomId })).shared.runs).toBe(2);
  });

  it("rechaza editar compartido en carrera y elimina salas, participantes y solicitudes con su clase", async () => {
    const { t, teacher, classroomId, roomId, a } = await setup();
    await teacher.mutation(api.liveRooms.setStatus, { roomId, status: "running" });
    await expect(t.mutation(api.liveRooms.editShared, { token: a, roomId, revision: 0, action: "clear" })).rejects.toThrow(/colaborativo/);
    await t.mutation(api.liveRooms.run, { token: a, roomId, program: [], requestId: "request" });
    await teacher.mutation(api.classrooms.remove, { classroomId });
    expect(await t.run(async (ctx) => Promise.all([ctx.db.query("liveRooms").collect(), ctx.db.query("liveParticipants").collect(), ctx.db.query("liveRunRequests").collect()]))).toEqual([[], [], []]);
    await expect(teacher.query(api.liveRooms.teacherView, { roomId })).rejects.toThrow(/No encontramos/);
  });
});
