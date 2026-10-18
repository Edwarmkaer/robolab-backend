import { ConvexError, v } from "convex/values";
import { LIVE_MAZES, MAX_LIVE_PARTICIPANTS, editLiveProgram, mazeFor, parseLiveProgram } from "../domain/live/maze";
import { requireRunning, requireUnsolved, requireRevision, requireCanJoin, requireCanStart, requireRequestId, requireRunInterval } from "../domain/live/rules";
import { simulate } from "../domain/game/simulator";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { classroomLabel, requireOwnClassroom, requireStudent, requireTeacher } from "./lib/access";
import { liveCommand, liveMode, roomSummary, roomView } from "./lib/liveValidators";

async function roomOf(ctx: QueryCtx, roomId: Id<"liveRooms">) {
  const room = await ctx.db.get(roomId);
  if (!room) throw new ConvexError("No encontramos esa sala.");
  return room;
}
async function teacherRoom(ctx: QueryCtx, roomId: Id<"liveRooms">) {
  const teacherId = await requireTeacher(ctx);
  const room = await roomOf(ctx, roomId);
  const classroom = await requireOwnClassroom(ctx, teacherId, room.classroomId);
  return { room, classroom };
}
async function studentRoom(ctx: QueryCtx, token: string, roomId: Id<"liveRooms">) {
  const { student, classroom } = await requireStudent(ctx, token);
  const room = await roomOf(ctx, roomId);
  if (room.classroomId !== classroom._id) throw new ConvexError("No encontramos esa sala.");
  return { room, classroom, student };
}
function initialProgress(mazeId: string) {
  const map = mazeFor(mazeId);
  return { program: [] as ReturnType<typeof parseLiveProgram>, runs: 0, outcome: null, finishedAt: null, state: { cell: map.start, heading: map.startHeading } };
}
function summary(room: Doc<"liveRooms">, classroom: Doc<"classrooms">) {
  return {
    roomId: room._id, classroomId: classroom._id, classroomLabel: classroomLabel(classroom), joinCode: classroom.joinCode ?? null,
    title: LIVE_MAZES.find((m) => m.id === room.mazeId)!.title, mazeId: room.mazeId, mode: room.mode, status: room.status,
  };
}
async function view(ctx: QueryCtx, room: Doc<"liveRooms">, classroom: Doc<"classrooms">, studentId?: Id<"students">) {
  const participants = await ctx.db.query("liveParticipants").withIndex("by_roomId", (q) => q.eq("roomId", room._id)).take(MAX_LIVE_PARTICIPANTS);
  const me = studentId ? participants.find((p) => p.studentId === studentId) : null;
  return {
    ...summary(room, classroom), startedAt: room.startedAt, closedAt: room.closedAt,
    participants: participants.map((p) => ({ studentId: p.studentId, displayName: p.displayName, runs: p.runs, outcome: p.outcome, finishedAt: p.finishedAt, place: p.place })),
    shared: room.shared,
    me: me ? { studentId: me.studentId, program: me.program, runs: me.runs, outcome: me.outcome, finishedAt: me.finishedAt, state: me.state } : null,
  };
}
async function participant(ctx: QueryCtx, roomId: Id<"liveRooms">, studentId: Id<"students">) {
  const player = await ctx.db.query("liveParticipants").withIndex("by_roomId_and_studentId", (q) => q.eq("roomId", roomId).eq("studentId", studentId)).unique();
  if (!player) throw new ConvexError("Debes unirte a la sala antes de participar.");
  return player;
}
function domain<T>(operation: () => T): T {
  try { return operation(); } catch (error) { throw new ConvexError(error instanceof Error ? error.message : "Revisa el programa."); }
}

export const create = mutation({
  args: { classroomId: v.id("classrooms"), mazeId: v.string(), mode: liveMode }, returns: v.id("liveRooms"),
  handler: async (ctx, { classroomId, mazeId, mode }) => {
    const teacherId = await requireTeacher(ctx);
    await requireOwnClassroom(ctx, teacherId, classroomId);
    const progress = domain(() => initialProgress(mazeId));
    return await ctx.db.insert("liveRooms", {
      teacherId, classroomId, mazeId, mode, status: "waiting", createdAt: Date.now(), startedAt: null, closedAt: null,
      participantCount: 0, finisherCount: 0, shared: { ...progress, revision: 0 },
    });
  },
});
export const listMine = query({
  args: {}, returns: v.array(roomSummary),
  handler: async (ctx) => {
    const teacherId = await requireTeacher(ctx);
    const rooms = await ctx.db.query("liveRooms").withIndex("by_teacherId", (q) => q.eq("teacherId", teacherId)).order("desc").take(30);
    const rows = await Promise.all(rooms.map(async (room) => {
      // Una clase borrada puede conservar salas solo hasta que termine su limpieza por lotes.
      if (!(await ctx.db.get(room.classroomId))) return null;
      const classroom = await requireOwnClassroom(ctx, teacherId, room.classroomId);
      return { ...summary(room, classroom), participantCount: room.participantCount };
    }));
    return rows.filter((row) => row !== null);
  },
});
export const listForStudent = query({
  args: { token: v.string() }, returns: v.array(roomSummary),
  handler: async (ctx, { token }) => {
    const { classroom } = await requireStudent(ctx, token);
    const rooms = await ctx.db.query("liveRooms").withIndex("by_classroomId", (q) => q.eq("classroomId", classroom._id)).order("desc").take(30);
    return rooms.map((room) => ({ ...summary(room, classroom), participantCount: room.participantCount }));
  },
});
export const teacherView = query({
  args: { roomId: v.id("liveRooms") }, returns: roomView,
  handler: async (ctx, { roomId }) => { const { room, classroom } = await teacherRoom(ctx, roomId); return await view(ctx, room, classroom); },
});
export const studentView = query({
  args: { token: v.string(), roomId: v.id("liveRooms") }, returns: roomView,
  handler: async (ctx, { token, roomId }) => { const { room, classroom, student } = await studentRoom(ctx, token, roomId); return await view(ctx, room, classroom, student._id); },
});
export const join = mutation({
  args: { token: v.string(), roomId: v.id("liveRooms") }, returns: v.null(),
  handler: async (ctx, { token, roomId }) => {
    const { room, student } = await studentRoom(ctx, token, roomId);
    const exists = await ctx.db.query("liveParticipants").withIndex("by_roomId_and_studentId", (q) => q.eq("roomId", roomId).eq("studentId", student._id)).unique();
    if (exists) return null;
    domain(() => requireCanJoin(room.status, room.participantCount));
    await ctx.db.insert("liveParticipants", { roomId, classroomId: room.classroomId, studentId: student._id, displayName: student.displayName, ...initialProgress(room.mazeId), place: null, lastRunAt: null });
    await ctx.db.patch(roomId, { participantCount: room.participantCount + 1 });
    return null;
  },
});
export const setStatus = mutation({
  args: { roomId: v.id("liveRooms"), status: v.union(v.literal("running"), v.literal("closed")) }, returns: v.null(),
  handler: async (ctx, { roomId, status }) => {
    const { room } = await teacherRoom(ctx, roomId);
    if (room.status === status) return null;
    if (room.status === "closed") throw new ConvexError("La sala está cerrada.");
    if (status === "running") domain(() => requireCanStart(room.participantCount));
    if (status === "running") await ctx.db.patch(roomId, { status, startedAt: Date.now() });
    else await ctx.db.patch(roomId, { status, closedAt: Date.now() });
    return null;
  },
});
export const editShared = mutation({
  args: { token: v.string(), roomId: v.id("liveRooms"), revision: v.number(), action: v.union(v.literal("append"), v.literal("undo"), v.literal("clear")), command: v.optional(liveCommand) }, returns: v.null(),
  handler: async (ctx, { token, roomId, revision, action, command }) => {
    const { room, student } = await studentRoom(ctx, token, roomId);
    await participant(ctx, roomId, student._id);
    domain(() => requireRunning(room.status));
    if (room.mode !== "cooperative") throw new ConvexError("El programa compartido es solo del modo colaborativo.");
    domain(() => requireUnsolved(room.shared.finishedAt));
    domain(() => requireRevision(revision, room.shared.revision));
    const program = domain(() => editLiveProgram(room.shared.program, action, command));
    await ctx.db.patch(roomId, { shared: { ...room.shared, ...initialProgress(room.mazeId), program, revision: room.shared.revision + 1, runs: room.shared.runs } });
    return null;
  },
});
export const run = mutation({
  args: { token: v.string(), roomId: v.id("liveRooms"), program: v.optional(v.array(liveCommand)), revision: v.optional(v.number()), requestId: v.string() }, returns: v.null(),
  handler: async (ctx, { token, roomId, program, revision, requestId }) => {
    const { room, student } = await studentRoom(ctx, token, roomId);
    const player = await participant(ctx, roomId, student._id);
    domain(() => requireRequestId(requestId));
    const duplicate = await ctx.db.query("liveRunRequests").withIndex("by_roomId_and_studentId_and_requestId", (q) => q.eq("roomId", roomId).eq("studentId", student._id).eq("requestId", requestId)).unique();
    if (duplicate) return null;
    domain(() => requireRunning(room.status));
    const progress = room.mode === "race" ? player : room.shared;
    domain(() => requireUnsolved(progress.finishedAt));
    let commands;
    if (room.mode === "cooperative") {
      domain(() => requireRevision(revision, room.shared.revision));
      if (program !== undefined) throw new ConvexError("Ejecuta el programa compartido de la sala.");
      commands = room.shared.program;
    } else commands = domain(() => parseLiveProgram(program));
    const now = Date.now();
    domain(() => requireRunInterval(now, player.lastRunAt));
    const simulation = simulate(mazeFor(room.mazeId), commands);
    const outcome = simulation.outcome.kind;
    const state = simulation.steps.at(-1)?.state ?? simulation.initial;
    const finishedAt = outcome === "GOAL" ? now : null;
    await ctx.db.insert("liveRunRequests", { roomId, classroomId: room.classroomId, studentId: student._id, requestId });
    if (room.mode === "race") {
      await ctx.db.patch(player._id, { program: commands, runs: player.runs + 1, outcome, state, finishedAt, lastRunAt: now, place: finishedAt !== null ? room.finisherCount + 1 : null });
      if (finishedAt !== null) await ctx.db.patch(roomId, { finisherCount: room.finisherCount + 1 });
    } else {
      await ctx.db.patch(roomId, { shared: { ...room.shared, runs: room.shared.runs + 1, outcome, state, finishedAt } });
      await ctx.db.patch(player._id, { runs: player.runs + 1, outcome, state, lastRunAt: now });
    }
    return null;
  },
});
