import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { removeLiveClassroom } from "./lib/liveCleanup";

export const remove = internalMutation({
  args: { classroomId: v.id("classrooms") }, returns: v.null(),
  handler: async (ctx, { classroomId }) => {
    await removeLiveClassroom(ctx, classroomId);
    return null;
  },
});
