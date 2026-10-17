import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { classroomLabel, requireOwnClassroom, requireTeacher } from "./lib/access";
import { uniqueAccessCode } from "./lib/codes";
import { LIMITS, cleanText } from "./lib/rules";
import { parseStudentList } from "../domain/classroom/studentName";
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

export const addStudents = mutation({
  args: { classroomId: v.id("classrooms"), names: v.array(v.string()) },
  handler: async (ctx, { classroomId, names }) => {
    const teacherId = await requireTeacher(ctx);
    await requireOwnClassroom(ctx, teacherId, classroomId);
    const existing = await ctx.db
      .query("students")
      .withIndex("by_classroom", (q) => q.eq("classroomId", classroomId))
      .collect();

    // Se valida toda la lista antes de guardar: si una línea falla, no se guarda ninguna.
    const parsed = parseStudentList(
      names.join("\n"),
      existing.map((s) => s.displayName),
    );
    const problem = parsed.entries.findIndex((e) => e.status !== "ok");
    const entry = parsed.entries[problem];
    if (entry && entry.status !== "ok") {
      throw new ConvexError(`Alumno ${problem + 1} («${entry.input}»): ${entry.reason}`);
    }
    if (parsed.names.length === 0) throw new ConvexError("Escribe al menos un nombre.");
    if (parsed.names.length > LIMITS.studentsPerBatch) {
      throw new ConvexError(`Agrega hasta ${LIMITS.studentsPerBatch} alumnos a la vez.`);
    }

    const created: { displayName: string; accessCode: string }[] = [];
    for (const displayName of parsed.names) {
      const accessCode = await uniqueAccessCode(ctx);
      await ctx.db.insert("students", { classroomId, displayName, accessCode, createdAt: Date.now() });
      created.push({ displayName, accessCode });
    }
    return created;
  },
});
