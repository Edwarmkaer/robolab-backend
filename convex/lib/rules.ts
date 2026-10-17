/**
 * Reglas de negocio de los datos que escribe el docente. Las reglas en sí
 * viven en el dominio (las comparte el formulario); aquí se convierten en
 * errores para el usuario.
 */
import { ConvexError } from "convex/values";
import { isCalendarDate } from "../../src/domain/evaluation/calendar";
import { LIMITS, type QuestionInput, normalizeText, questionIssues } from "../../src/domain/evaluation/rules";

export { LIMITS };
export type { QuestionInput };

const fail = (message: string): never => {
  throw new ConvexError(message);
};

export function cleanText(value: string, field: string, min: number, max: number): string {
  const text = normalizeText(value);
  if (text.length < min) fail(`${field}: escribe al menos ${min} caracteres.`);
  if (text.length > max) fail(`${field}: máximo ${max} caracteres.`);
  return text;
}

export type CleanQuestion = { prompt: string; options: string[]; correctOption: number; points: number };

export function cleanQuestions(questions: readonly QuestionInput[]): CleanQuestion[] {
  if (questions.length < LIMITS.questionsMin || questions.length > LIMITS.questionsMax) {
    fail(`Agrega entre ${LIMITS.questionsMin} y ${LIMITS.questionsMax} preguntas.`);
  }
  const [issue] = questionIssues(questions);
  if (issue) fail(`Pregunta ${issue.question + 1}: ${issue.summary}`);
  return questions.map((q) => ({
    prompt: normalizeText(q.prompt),
    options: q.options.map(normalizeText),
    correctOption: q.correctOption,
    points: q.points,
  }));
}

export function requireCalendarDate(value: string): string {
  if (!isCalendarDate(value)) fail("Elige una fecha válida.");
  return value;
}
