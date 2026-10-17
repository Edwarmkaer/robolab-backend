import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const educationLevel = v.union(
  v.literal("inicial"),
  v.literal("primaria"),
  v.literal("secundaria"),
);

export default defineSchema({
  // Tablas de Convex Auth. Los docentes son los usuarios autenticados.
  ...authTables,

  classrooms: defineTable({
    teacherId: v.id("users"),
    level: educationLevel,
    grade: v.string(),
    section: v.string(),
    createdAt: v.number(),
  }).index("by_teacher", ["teacherId"]),

  // Los alumnos no tienen cuenta: entran con un código que les da el docente.
  students: defineTable({
    classroomId: v.id("classrooms"),
    displayName: v.string(),
    accessCode: v.string(),
    createdAt: v.number(),
  })
    .index("by_classroom", ["classroomId"])
    .index("by_access_code", ["accessCode"]),

  evaluations: defineTable({
    teacherId: v.id("users"),
    classroomId: v.id("classrooms"),
    title: v.string(),
    scheduledDate: v.string(), // "AAAA-MM-DD" del calendario del docente
    createdAt: v.number(),
  })
    .index("by_teacher_date", ["teacherId", "scheduledDate"])
    .index("by_classroom_date", ["classroomId", "scheduledDate"]),

  // La respuesta correcta vive solo aquí y nunca se envía al alumno.
  questions: defineTable({
    evaluationId: v.id("evaluations"),
    order: v.number(),
    prompt: v.string(),
    options: v.array(v.string()),
    correctOption: v.number(),
    points: v.number(),
  }).index("by_evaluation_order", ["evaluationId", "order"]),

  studentSessions: defineTable({
    studentId: v.id("students"),
    token: v.string(),
    expiresAt: v.number(),
  }).index("by_token", ["token"]),

  attempts: defineTable({
    evaluationId: v.id("evaluations"),
    studentId: v.id("students"),
    startedAt: v.number(),
    stage: v.number(), // etapa actual del minijuego, 0-based
    questionShownAt: v.optional(v.number()), // pregunta de la etapa ya desbloqueada
    finishedAt: v.optional(v.number()),
    score: v.optional(v.number()),
    maxScore: v.optional(v.number()),
    percent: v.optional(v.number()),
    totalMs: v.optional(v.number()),
  })
    .index("by_student_evaluation", ["studentId", "evaluationId"])
    .index("by_evaluation", ["evaluationId"]),

  answers: defineTable({
    attemptId: v.id("attempts"),
    questionId: v.id("questions"),
    stage: v.number(),
    chosenOption: v.number(),
    isCorrect: v.boolean(),
    pointsAwarded: v.number(),
    shownAt: v.number(),
    answeredAt: v.number(),
    blocksUsed: v.number(),
    runs: v.number(),
  }).index("by_attempt", ["attemptId"]),
});
