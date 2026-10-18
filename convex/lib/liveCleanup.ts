import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";

/** Cada lote cabe en una transacción incluso si la clase acumuló muchos retos. */
export async function removeLiveClassroom(ctx: MutationCtx, classroomId: Id<"classrooms">) {
  for (const table of ["liveRunRequests", "liveParticipants", "liveRooms"] as const) {
    const rows = await ctx.db.query(table).withIndex("by_classroomId", (q) => q.eq("classroomId", classroomId)).take(100);
    for (const row of rows) await ctx.db.delete(row._id);
    if (rows.length === 100) {
      await ctx.scheduler.runAfter(0, internal.liveRoomCleanup.remove, { classroomId });
      return;
    }
  }
}
