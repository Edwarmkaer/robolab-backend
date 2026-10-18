import { v } from "convex/values";

export const liveMode = v.union(v.literal("race"), v.literal("cooperative"));
export const liveStatus = v.union(v.literal("waiting"), v.literal("running"), v.literal("closed"));
export const liveCommand = v.union(v.literal("FORWARD"), v.literal("BACKWARD"), v.literal("TURN_LEFT"), v.literal("TURN_RIGHT"));
export const liveOutcome = v.union(v.literal("GOAL"), v.literal("OFF_PATH"), v.literal("INCOMPLETE"), v.literal("EMPTY"));
export const robotState = v.object({ cell: v.object({ row: v.number(), col: v.number() }), heading: v.union(v.literal(0), v.literal(90), v.literal(180), v.literal(270)) });
const nullableNumber = v.union(v.number(), v.null());
export const liveProgress = {
  program: v.array(liveCommand), runs: v.number(), outcome: v.union(liveOutcome, v.null()), finishedAt: nullableNumber, state: robotState,
};
const summary = {
  roomId: v.id("liveRooms"), classroomId: v.id("classrooms"), classroomLabel: v.string(), joinCode: v.union(v.string(), v.null()),
  title: v.string(), mazeId: v.string(), mode: liveMode, status: liveStatus,
};
export const roomSummary = v.object({ ...summary, participantCount: v.number() });
export const roomView = v.object({
  ...summary, startedAt: nullableNumber, closedAt: nullableNumber,
  participants: v.array(v.object({ studentId: v.id("students"), displayName: v.string(), runs: v.number(), outcome: v.union(liveOutcome, v.null()), finishedAt: nullableNumber, place: nullableNumber })),
  shared: v.object({ ...liveProgress, revision: v.number() }),
  me: v.union(v.null(), v.object({ ...liveProgress, studentId: v.id("students") })),
});
