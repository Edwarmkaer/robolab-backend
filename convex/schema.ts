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
    // Vez que rinde la evaluación (1, 2, 3…). Los intentos antiguos no lo tienen: son la 1.
    number: v.optional(v.number()),
    startedAt: v.number(),
    stage: v.number(), // etapa actual del minijuego, 0-based
    questionShownAt: v.optional(v.number()), // pregunta de la etapa ya desbloqueada
    finishedAt: v.optional(v.number()),
    score: v.optional(v.number()),
    maxScore: v.optional(v.number()),
    percent: v.optional(v.number()),
    totalMs: v.optional(v.number()),
    totalRuns: v.optional(v.number()), // veces que tocó "Ejecutar" en todo el intento
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

  // Cada vez que el alumno toca "Ejecutar": el servidor lo simula y lo anota.
  runs: defineTable({
    attemptId: v.id("attempts"),
    stage: v.number(),
    outcome: v.union(v.literal("GOAL"), v.literal("OFF_PATH"), v.literal("INCOMPLETE"), v.literal("EMPTY")),
    failedStep: v.optional(v.number()),
    blocks: v.number(),
    createdAt: v.number(),
  }).index("by_attempt_stage", ["attemptId", "stage"]),

  // Modo abierto: una fila por reto jugado, con un id de dispositivo al azar (sin nombres).
  explorePlays: defineTable({
    deviceId: v.string(),
    challengeId: v.string(),
    solved: v.boolean(),
    runs: v.number(),
    hints: v.number(),
    ms: v.number(),
    createdAt: v.number(),
  }).index("by_device_time", ["deviceId", "createdAt"]),

  // Robots físicos (ESP32 por wifi). La clave solo se guarda cifrada (SHA-256).
  robots: defineTable({
    name: v.string(),
    code: v.string(),
    keyHash: v.string(),
    createdAt: v.number(),
    lastSeenAt: v.optional(v.number()),
  }).index("by_code", ["code"]),

  // Programas enviados a un robot, en letras (A R D Z).
  robotCommands: defineTable({
    robotId: v.id("robots"),
    letters: v.string(),
    status: v.union(v.literal("pending"), v.literal("sent"), v.literal("done"), v.literal("replaced")),
    createdAt: v.number(),
    sentAt: v.optional(v.number()),
    doneAt: v.optional(v.number()),
  })
    .index("by_robot", ["robotId"])
    .index("by_robot_status", ["robotId", "status"]),

  // Registro de cada correo pedido: confirma si salió y sirve para frenar abusos.
  emailDeliveries: defineTable({
    to: v.string(),
    kind: v.literal("password-reset"),
    status: v.union(v.literal("pending"), v.literal("sent"), v.literal("failed")),
    provider: v.optional(v.string()),
    providerMessageId: v.optional(v.string()),
    requestedAt: v.number(),
    settledAt: v.optional(v.number()),
  }).index("by_to_requested", ["to", "requestedAt"]),
});
