import { ConvexError, v } from "convex/values";
import { generateAccessCode } from "../src/domain/evaluation/accessCode";
import type { Id } from "./_generated/dataModel";
import { type MutationCtx, mutation, query } from "./_generated/server";
import { classroomLabel, requireOwnClassroom, requireTeacher } from "./lib/access";
import { LIMITS, cleanText } from "./lib/rules";
import { educationLevel } from "./schema";

export const create = mutation({
  args: { level: educationLevel, grade: v.string(), section: v.string() },
  handler: async (ctx, args): Promise<Id<"classrooms">> => {
    const teacherId = await requireTeacher(ctx);
    const grade = cleanText(args.grade, "Grado", 1, LIMITS.gradeMax);
    const section = cleanText(args.section, "Sección", 1, LIMITS.sectionMax).toUpperCase();
    const mine = await ctx.db
      .query("classrooms")
      .withIndex("by_teacher", (q) => q.eq("teacherId", teacherId))
      .collect();
    const duplicate = mine.some(
      (c) => c.level === args.level && c.grade.toLowerCase() === grade.toLowerCase() && c.section === section,
    );
    if (duplicate) throw new ConvexError("Ya tienes esa clase.");
    return await ctx.db.insert("classrooms", {
      teacherId,
      level: args.level,
      grade,
      section,
      createdAt: Date.now(),
    });
  },
});

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const teacherId = await requireTeacher(ctx);
    const classrooms = await ctx.db
      .query("classrooms")
      .withIndex("by_teacher", (q) => q.eq("teacherId", teacherId))
      .collect();
    return await Promise.all(
      classrooms.map(async (c) => {
        const students = await ctx.db
          .query("students")
          .withIndex("by_classroom", (q) => q.eq("classroomId", c._id))
          .collect();
        return {
          _id: c._id,
          level: c.level,
          grade: c.grade,
          section: c.section,
          label: classroomLabel(c),
          studentCount: students.length,
        };
      }),
    );
  },
});

export const get = query({
  args: { classroomId: v.id("classrooms") },
  handler: async (ctx, { classroomId }) => {
    const teacherId = await requireTeacher(ctx);
    const classroom = await requireOwnClassroom(ctx, teacherId, classroomId);
    const students = await ctx.db
      .query("students")
      .withIndex("by_classroom", (q) => q.eq("classroomId", classroomId))
      .collect();
    return {
      _id: classroom._id,
      level: classroom.level,
      label: classroomLabel(classroom),
      students: students
        .map((s) => ({ _id: s._id, displayName: s.displayName, accessCode: s.accessCode }))
        .sort((a, b) => a.displayName.localeCompare(b.displayName, "es")),
    };
  },
});

async function uniqueAccessCode(ctx: MutationCtx): Promise<string> {
  // 31^6 ≈ 887 millones de combinaciones: una colisión es rarísima, pero se verifica.
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateAccessCode();
    const taken = await ctx.db
      .query("students")
      .withIndex("by_access_code", (q) => q.eq("accessCode", code))
      .first();
    if (!taken) return code;
  }
  throw new ConvexError("No pudimos generar un código. Intenta de nuevo.");
}

export const addStudents = mutation({
  args: { classroomId: v.id("classrooms"), names: v.array(v.string()) },
  handler: async (ctx, { classroomId, names }) => {
    const teacherId = await requireTeacher(ctx);
    await requireOwnClassroom(ctx, teacherId, classroomId);
    const clean = names.map((n) => n.trim()).filter((n) => n.length > 0);
    if (clean.length === 0) throw new ConvexError("Escribe al menos un nombre.");
    if (clean.length > LIMITS.studentsPerBatch) {
      throw new ConvexError(`Agrega hasta ${LIMITS.studentsPerBatch} alumnos a la vez.`);
    }
    const created: { displayName: string; accessCode: string }[] = [];
    for (const raw of clean) {
      const displayName = cleanText(raw, "Nombre", 2, LIMITS.nameMax);
      const accessCode = await uniqueAccessCode(ctx);
      await ctx.db.insert("students", { classroomId, displayName, accessCode, createdAt: Date.now() });
      created.push({ displayName, accessCode });
    }
    return created;
  },
});
