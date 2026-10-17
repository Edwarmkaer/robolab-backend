/**
 * Reglas de negocio de los datos que escribe el docente. Están separadas de
 * las funciones de Convex para probarlas sin base de datos.
 */
import { ConvexError } from "convex/values";
import { isCalendarDate } from "../../src/domain/evaluation/calendar";

export const LIMITS = {
  titleMin: 3,
  titleMax: 80,
  gradeMax: 30,
  sectionMax: 10,
  nameMax: 60,
  promptMax: 200,
  optionMax: 80,
  optionsMin: 2,
  optionsMax: 4,
  questionsMin: 1,
  questionsMax: 10,
  pointsMin: 1,
  pointsMax: 20,
  studentsPerBatch: 40,
} as const;

export type QuestionInput = {
  prompt: string;
  options: string[];
  correctOption: number;
  points: number;
};

const fail = (message: string): never => {
  throw new ConvexError(message);
};

export function cleanText(value: string, field: string, min: number, max: number): string {
  const text = value.trim().replace(/\s+/g, " ");
  if (text.length < min) fail(`${field}: escribe al menos ${min} caracteres.`);
  if (text.length > max) fail(`${field}: máximo ${max} caracteres.`);
  return text;
}

export function cleanQuestions(questions: QuestionInput[]): QuestionInput[] {
  if (questions.length < LIMITS.questionsMin || questions.length > LIMITS.questionsMax) {
    fail(`Agrega entre ${LIMITS.questionsMin} y ${LIMITS.questionsMax} preguntas.`);
  }
  return questions.map((q, i) => {
    const n = i + 1;
    const prompt = cleanText(q.prompt, `Pregunta ${n}`, 1, LIMITS.promptMax);
    if (q.options.length < LIMITS.optionsMin || q.options.length > LIMITS.optionsMax) {
      fail(`Pregunta ${n}: usa entre ${LIMITS.optionsMin} y ${LIMITS.optionsMax} alternativas.`);
    }
    const options = q.options.map((o, j) =>
      cleanText(o, `Pregunta ${n}, alternativa ${j + 1}`, 1, LIMITS.optionMax),
    );
    if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) {
      fail(`Pregunta ${n}: hay alternativas repetidas.`);
    }
    if (!Number.isInteger(q.correctOption) || q.correctOption < 0 || q.correctOption >= options.length) {
      fail(`Pregunta ${n}: marca la respuesta correcta.`);
    }
    if (!Number.isInteger(q.points) || q.points < LIMITS.pointsMin || q.points > LIMITS.pointsMax) {
      fail(`Pregunta ${n}: el puntaje va de ${LIMITS.pointsMin} a ${LIMITS.pointsMax}.`);
    }
    return { prompt, options, correctOption: q.correctOption, points: q.points };
  });
}

export function requireCalendarDate(value: string): string {
  if (!isCalendarDate(value)) fail("Elige una fecha válida.");
  return value;
}
