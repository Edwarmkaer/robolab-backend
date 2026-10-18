import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

const QUESTIONS = [{ prompt: "¿2+2?", options: ["3", "4"], correctOption: 1, points: 1 }];

describe("portada del docente (T2)", () => {
  it("saluda por el nombre y resume clases, alumnos, retos disponibles y evaluaciones de hoy", async () => {
    const t = convexTest(schema, modules);
    const anaId = await t.run((ctx) => ctx.db.insert("users", { name: "Ana Pérez Quispe", email: "ana@colegio.pe" }));
    const teacher = t.withIdentity({ subject: `${anaId}|s1` });
    const fifth = await teacher.mutation(api.classrooms.create, { level: "primaria", grade: "5.º", section: "A" });
    const third = await teacher.mutation(api.classrooms.create, { level: "inicial", grade: "3 años", section: "B" });
    const codes: Record<string, string> = Object.fromEntries((await teacher.query(api.classrooms.listMine, {})).map((c) => [c._id, c.joinCode ?? ""]));
    for (const [code, nickname] of [
      [codes[fifth]!, "Pingüino veloz"],
      [codes[fifth]!, "Zorro curioso"],
      [codes[third]!, "Puma rápido"],
    ] as const) {
      const joined = await t.mutation(api.student.join, { code, nickname });
      if ("error" in joined) throw new Error(joined.error);
    }
    await teacher.mutation(api.evaluations.create, { classroomId: fifth, title: "Hoy", scheduledDate: "2026-10-17", questions: QUESTIONS });
    await teacher.mutation(api.evaluations.create, { classroomId: fifth, title: "Mañana", scheduledDate: "2026-10-18", questions: QUESTIONS });

    const home = await teacher.query(api.teacherHome.home, {});
    expect(home).toMatchObject({
      firstName: "Ana",
      name: "Ana Pérez Quispe",
      activeClasses: 2,
      students: 3,
      availableChallenges: (await teacher.query(api.assignments.available, {})).length,
      classes: [
        { _id: fifth, label: "Primaria · 5.º · Sección A", joinCode: codes[fifth], studentCount: 2, level: "primaria" },
        { _id: third, label: "Inicial · 3 años · Sección B", joinCode: codes[third], studentCount: 1, level: "inicial" },
      ],
      todays: [{ title: "Hoy", classroomLabel: "Primaria · 5.º · Sección A", studentCount: 2, questionCount: 1 }],
    });
    expect(home.availableChallenges).toBeGreaterThan(0);
  });

  it("un docente nuevo ve todo en cero; sin sesión no hay portada", async () => {
    const t = convexTest(schema, modules);
    const luisId = await t.run((ctx) => ctx.db.insert("users", { name: "Luis", email: "luis@colegio.pe" }));
    const other = t.withIdentity({ subject: `${luisId}|s2` });
    expect(await other.query(api.teacherHome.home, {})).toMatchObject({ firstName: "Luis", activeClasses: 0, students: 0, classes: [], todays: [] });
    await expect(t.query(api.teacherHome.home, {})).rejects.toThrow(/Inicia sesión/);
  });
});
