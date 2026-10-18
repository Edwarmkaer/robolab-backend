import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { move } from "../domain/game/program";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { modules } from "./test.setup";

// Las evaluaciones de estas pruebas son del 17 de octubre de 2026: el reloj del servidor se fija ese día (3 p. m. en Lima).
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(Date.UTC(2026, 9, 17, 20, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

const TODAY = "2026-10-17";

const SOLUTIONS = {
  stage0: [move("FORWARD"), move("FORWARD"), move("FORWARD")],
  stage1: [
    move("FORWARD"),
    move("TURN_RIGHT"),
    move("FORWARD"),
    move("FORWARD"),
    move("TURN_LEFT"),
    move("FORWARD"),
  ],
};

const QUESTIONS = [
  { prompt: "¿Cuántas patas tiene un gato?", options: ["2", "4", "6"], correctOption: 1, points: 2 },
  { prompt: "¿De qué color es el cielo de día?", options: ["Azul", "Verde"], correctOption: 0, points: 3 },
];

async function setup() {
  const t = convexTest(schema, modules);
  const teacherId = await t.run((ctx) => ctx.db.insert("users", { name: "Rosa", email: "rosa@colegio.pe" }));
  const otherId = await t.run((ctx) => ctx.db.insert("users", { name: "Luis", email: "luis@colegio.pe" }));
  const teacher = t.withIdentity({ subject: `${teacherId}|sesion-1` });
  const other = t.withIdentity({ subject: `${otherId}|sesion-2` });

  const classroomId = await teacher.mutation(api.classrooms.create, { level: "inicial", grade: "5 años", section: "a" });
  const [ana, beto] = await teacher.mutation(api.classrooms.addStudents, { classroomId, names: ["Ana", " Beto "] });
  const evaluationId = await teacher.mutation(api.evaluations.create, {
    classroomId,
    title: "Animales y colores",
    scheduledDate: TODAY,
    questions: QUESTIONS,
  });
  return { t, teacher, other, classroomId, evaluationId, ana: ana!, beto: beto! };
}

async function signInStudent(t: Awaited<ReturnType<typeof setup>>["t"], code: string) {
  const signedIn = await t.mutation(api.student.signIn, { code: code.toLowerCase() });
  if ("error" in signedIn) throw new Error(signedIn.error);
  const { token } = signedIn;
  return token;
}

describe("docente", () => {
  it("crea su clase, sus alumnos con códigos únicos y una evaluación del día", async () => {
    const { teacher, ana, beto } = await setup();
    expect(ana.displayName).toBe("Ana");
    expect(beto.displayName).toBe("Beto");
    expect(ana.accessCode).not.toBe(beto.accessCode);

    const classes = await teacher.query(api.classrooms.listMine, {});
    expect(classes).toMatchObject([{ label: "Inicial · 5 años · Sección A", studentCount: 2 }]);

    const today = await teacher.query(api.evaluations.listForDate, { date: TODAY });
    expect(today).toMatchObject([{ title: "Animales y colores", questionCount: 2, maxScore: 5, studentCount: 2 }]);
    expect(await teacher.query(api.evaluations.listForDate, { date: "2026-10-18" })).toEqual([]);
  });

  it("limpia los nombres de los alumnos y rechaza caracteres extraños o repetidos", async () => {
    const { teacher, classroomId } = await setup();
    const [carla] = await teacher.mutation(api.classrooms.addStudents, { classroomId, names: ["  carla​  maría "] });
    expect(carla!.displayName).toBe("Carla María");

    await expect(
      teacher.mutation(api.classrooms.addStudents, { classroomId, names: ["Diego", "<script>"] }),
    ).rejects.toThrow(/Alumno 2 .*caracteres no permitidos: < >/);
    await expect(teacher.mutation(api.classrooms.addStudents, { classroomId, names: ["ANA"] })).rejects.toThrow(
      /Ya está en la clase/,
    );
    await expect(
      teacher.mutation(api.classrooms.addStudents, { classroomId, names: ["Diego", "diego"] }),
    ).rejects.toThrow(/repetido/);

    // Nada se guarda si una línea falla.
    const classroom = await teacher.query(api.classrooms.get, { classroomId });
    expect(classroom.students.map((s) => s.displayName)).toEqual(["Ana", "Beto", "Carla María"]);
  });

  it("no puede ver ni usar clases o evaluaciones de otro docente", async () => {
    const { other, classroomId, evaluationId } = await setup();
    await expect(other.query(api.classrooms.get, { classroomId })).rejects.toThrow(/No encontramos/);
    await expect(other.query(api.evaluations.get, { evaluationId })).rejects.toThrow(/No encontramos/);
    await expect(
      other.mutation(api.classrooms.addStudents, { classroomId, names: ["Intruso"] }),
    ).rejects.toThrow(/No encontramos/);
    expect(await other.query(api.classrooms.listMine, {})).toEqual([]);
  });

  it("sin sesión no puede crear nada", async () => {
    const { t } = await setup();
    await expect(
      t.mutation(api.classrooms.create, { level: "inicial", grade: "4 años", section: "B" }),
    ).rejects.toThrow(/Inicia sesión/);
  });

  it("no repite la misma clase", async () => {
    const { teacher } = await setup();
    await expect(
      teacher.mutation(api.classrooms.create, { level: "inicial", grade: "5 AÑOS", section: "A" }),
    ).rejects.toThrow(/Ya tienes/);
  });

  it.each([
    ["respuesta fuera de rango", { ...QUESTIONS[0]!, correctOption: 3 }, /respuesta correcta/],
    ["alternativas repetidas", { ...QUESTIONS[0]!, options: ["Sí", "sí"] }, /repetidas/],
    ["puntaje cero", { ...QUESTIONS[0]!, points: 0 }, /puntaje/],
    ["una sola alternativa", { ...QUESTIONS[0]!, options: ["Sí"], correctOption: 0 }, /alternativas/],
  ])("rechaza preguntas con %s", async (_name, question, error) => {
    const { teacher, classroomId } = await setup();
    await expect(
      teacher.mutation(api.evaluations.create, {
        classroomId,
        title: "Prueba",
        scheduledDate: TODAY,
        questions: [question],
      }),
    ).rejects.toThrow(error);
  });

  it("rechaza fechas inexistentes", async () => {
    const { teacher, classroomId } = await setup();
    await expect(
      teacher.mutation(api.evaluations.create, {
        classroomId,
        title: "Prueba",
        scheduledDate: "2026-02-30",
        questions: QUESTIONS,
      }),
    ).rejects.toThrow(/fecha/);
  });
});

describe("alumno", () => {
  it("entra con su código y ve directamente su evaluación del día", async () => {
    const { t, ana } = await setup();
    const token = await signInStudent(t, ana.accessCode);
    const home = await t.query(api.student.home, { token, today: TODAY });
    expect(home).toMatchObject({
      displayName: "Ana",
      level: "inicial",
      evaluation: { title: "Animales y colores", questionCount: 2, finished: false, attemptId: null },
    });
  });

  it("rechaza códigos inexistentes o tokens inventados", async () => {
    const { t } = await setup();
    expect(await t.mutation(api.student.signIn, { code: "ZZZZZZ" })).toMatchObject({ error: expect.stringMatching(/No encontramos/) });
    expect(await t.mutation(api.student.signIn, { code: "abc" })).toMatchObject({ error: expect.stringMatching(/no es válido/) });
    await expect(t.query(api.student.home, { token: "falso", today: TODAY })).rejects.toThrow(/sesión/);
  });

  it("completa el minijuego, responde y obtiene su resultado", async () => {
    const { t, teacher, ana, evaluationId, classroomId } = await setup();
    const token = await signInStudent(t, ana.accessCode);
    const attemptId = await t.mutation(api.student.start, { token, evaluationId });
    expect(await t.mutation(api.student.start, { token, evaluationId })).toBe(attemptId);

    // Sin llegar a la estrella no hay pregunta, pero la ejecución queda anotada.
    expect(await t.mutation(api.student.submitRun, { token, attemptId, program: [move("FORWARD")] })).toEqual({
      outcome: "INCOMPLETE",
      question: null,
    });
    expect(
      await t.mutation(api.student.submitRun, { token, attemptId, program: [move("TURN_LEFT"), move("FORWARD")] }),
    ).toEqual({ outcome: "OFF_PATH", question: null });
    await expect(
      t.mutation(api.student.answer, { token, attemptId, chosenOption: 1, program: [] }),
    ).rejects.toThrow(/Primero lleva/);

    const run = await t.mutation(api.student.submitRun, { token, attemptId, program: SOLUTIONS.stage0 });
    expect(run.outcome).toBe("GOAL");
    expect(run.question).toEqual({ stage: 0, prompt: QUESTIONS[0]!.prompt, options: QUESTIONS[0]!.options, points: 2 });
    expect(run.question).not.toHaveProperty("correctOption");
    // Volver a pedirla (por ejemplo, al recargar) no suma otra ejecución.
    await t.mutation(api.student.submitRun, { token, attemptId, program: SOLUTIONS.stage0 });

    const a1 = await t.mutation(api.student.answer, { token, attemptId, chosenOption: 1, program: SOLUTIONS.stage0 });
    expect(a1).toEqual({ isCorrect: true, finished: false });

    // La segunda etapa usa otro mapa: la solución de la primera ya no sirve.
    expect((await t.mutation(api.student.submitRun, { token, attemptId, program: SOLUTIONS.stage0 })).outcome).not.toBe(
      "GOAL",
    );
    await t.mutation(api.student.submitRun, { token, attemptId, program: SOLUTIONS.stage1 });
    const a2 = await t.mutation(api.student.answer, { token, attemptId, chosenOption: 1, program: SOLUTIONS.stage1 });
    expect(a2).toEqual({ isCorrect: false, finished: true });

    const result = await t.query(api.student.result, { token, attemptId });
    expect(result).toMatchObject({ number: 1, score: 2, maxScore: 5, percent: 40, runs: 5 });
    expect(result?.answers.map((a) => [a.isCorrect, a.runs])).toEqual([
      [true, 3],
      [false, 2],
    ]);

    await expect(
      t.mutation(api.student.submitRun, { token, attemptId, program: SOLUTIONS.stage0 }),
    ).rejects.toThrow(/Ya terminaste/);

    const detail = await teacher.query(api.evaluations.get, { evaluationId });
    expect(detail.results.find((r) => r.displayName === "Ana")).toMatchObject({
      status: "finished",
      position: 1,
      percent: 40,
      runs: 5,
      tries: 1,
    });
    expect(detail.results.find((r) => r.displayName === "Beto")).toMatchObject({ status: "pending", position: null });

    const progress = await teacher.query(api.analytics.classProgress, { classroomId });
    expect(progress.evaluations).toMatchObject([
      { title: "Animales y colores", average: 40, finishedCount: 1, averageRunsPerStar: 2.5, averageTries: 1 },
    ]);
    expect(progress.students.find((s) => s.displayName === "Ana")?.series[0]).toMatchObject({
      percent: 40,
      runsPerStar: 2.5,
      tries: 1,
    });
  });

  it("puede intentarlo de nuevo; cuenta su mejor puntaje y cuántas veces lo necesitó", async () => {
    const { t, teacher, ana, beto, evaluationId } = await setup();
    const play = async (token: string, attemptId: Id<"attempts">, answers: [number, number]) => {
      await t.mutation(api.student.submitRun, { token, attemptId, program: SOLUTIONS.stage0 });
      await t.mutation(api.student.answer, { token, attemptId, chosenOption: answers[0], program: [] });
      await t.mutation(api.student.submitRun, { token, attemptId, program: SOLUTIONS.stage1 });
      await t.mutation(api.student.answer, { token, attemptId, chosenOption: answers[1], program: [] });
    };

    // Beto: 2 de 5 a la primera.
    const betoToken = await signInStudent(t, beto.accessCode);
    await play(betoToken, await t.mutation(api.student.start, { token: betoToken, evaluationId }), [1, 1]);

    // Ana: 0 de 5, y en su segunda vez 5 de 5.
    const token = await signInStudent(t, ana.accessCode);
    const first = await t.mutation(api.student.start, { token, evaluationId });
    await expect(t.mutation(api.student.retry, { token, evaluationId })).resolves.toBe(first); // aún no termina
    await play(token, first, [0, 1]);
    const second = await t.mutation(api.student.retry, { token, evaluationId });
    expect(second).not.toBe(first);
    expect(await t.mutation(api.student.retry, { token, evaluationId })).toBe(second); // no abre dos a la vez

    let detail = await teacher.query(api.evaluations.get, { evaluationId });
    expect(detail.results.find((r) => r.displayName === "Ana")).toMatchObject({ status: "retrying", attemptNumber: 2, percent: 0 });
    expect(detail).toMatchObject({ startedCount: 2, finishedCount: 2, playingCount: 1 });

    await play(token, second, [1, 0]);
    expect(await t.query(api.student.attempt, { token, attemptId: second })).toMatchObject({ number: 2, finished: true });
    expect(await t.query(api.student.home, { token, today: TODAY })).toMatchObject({
      evaluation: { attemptId: second, finished: true, tries: 2 },
    });

    detail = await teacher.query(api.evaluations.get, { evaluationId });
    expect(detail.results.map((r) => [r.displayName, r.position, r.percent, r.tries])).toEqual([
      ["Ana", 1, 100, 2],
      ["Beto", 2, 40, 1],
    ]);
  });

  it("rechaza bloques que su nivel no tiene", async () => {
    const { t, ana, evaluationId } = await setup();
    const token = await signInStudent(t, ana.accessCode);
    const attemptId = await t.mutation(api.student.start, { token, evaluationId });
    await expect(
      t.mutation(api.student.submitRun, {
        token,
        attemptId,
        program: [{ kind: "repeat", times: 3, body: [move("FORWARD")] }],
      }),
    ).rejects.toThrow(/no está disponible/);
  });

  it("no puede abrir intentos de otro alumno ni evaluaciones de otra clase", async () => {
    const { t, teacher, ana, beto, evaluationId } = await setup();
    const anaToken = await signInStudent(t, ana.accessCode);
    const betoToken = await signInStudent(t, beto.accessCode);
    const attemptId = await t.mutation(api.student.start, { token: anaToken, evaluationId });
    await expect(t.query(api.student.attempt, { token: betoToken, attemptId })).rejects.toThrow(/No encontramos/);

    const otherClass = await teacher.mutation(api.classrooms.create, { level: "inicial", grade: "4 años", section: "B" });
    const otherEval = await teacher.mutation(api.evaluations.create, {
      classroomId: otherClass,
      title: "Otra clase",
      scheduledDate: TODAY,
      questions: QUESTIONS,
    });
    await expect(t.mutation(api.student.start, { token: anaToken, evaluationId: otherEval })).rejects.toThrow(
      /no es de tu clase/,
    );
  });
});
