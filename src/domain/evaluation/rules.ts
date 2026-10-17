/**
 * Reglas de una evaluación. El formulario las usa para marcar cada campo
 * antes de guardar y el servidor para rechazar lo que no cumpla: los límites
 * y los mensajes salen de un solo lugar.
 */

export const LIMITS = {
  titleMin: 3,
  titleMax: 80,
  gradeMax: 30,
  sectionMax: 10,
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
  readonly prompt: string;
  readonly options: readonly string[];
  readonly correctOption: number;
  readonly points: number;
};

export type QuestionIssue = {
  /** Índice de la pregunta (desde 0). */
  readonly question: number;
  readonly field: "prompt" | "options" | "option" | "correct" | "points";
  readonly option?: number;
  /** Texto corto para mostrar junto al campo. */
  readonly message: string;
  /** Texto para una línea que empieza con "Pregunta N:". */
  readonly summary: string;
};

export const normalizeText = (value: string) => value.trim().replace(/\s+/g, " ");

export function questionIssues(questions: readonly QuestionInput[]): QuestionIssue[] {
  const issues: QuestionIssue[] = [];
  questions.forEach((q, question) => {
    const add = (issue: Omit<QuestionIssue, "question">) => issues.push({ question, ...issue });

    const prompt = normalizeText(q.prompt);
    if (prompt.length === 0) add({ field: "prompt", message: "Escribe la pregunta.", summary: "escribe la pregunta." });
    else if (prompt.length > LIMITS.promptMax) {
      const text = `máximo ${LIMITS.promptMax} caracteres.`;
      add({ field: "prompt", message: `Muy larga: ${text}`, summary: `la pregunta tiene ${text}` });
    }

    if (q.options.length < LIMITS.optionsMin || q.options.length > LIMITS.optionsMax) {
      const text = `usa entre ${LIMITS.optionsMin} y ${LIMITS.optionsMax} alternativas.`;
      add({ field: "options", message: text.charAt(0).toUpperCase() + text.slice(1), summary: text });
    }
    const seen = new Set<string>();
    q.options.forEach((raw, option) => {
      const text = normalizeText(raw);
      if (text.length === 0) {
        add({ field: "option", option, message: "Escribe esta alternativa.", summary: "hay una alternativa vacía." });
      } else if (text.length > LIMITS.optionMax) {
        add({ field: "option", option, message: `Máximo ${LIMITS.optionMax} caracteres.`, summary: "hay una alternativa muy larga." });
      } else if (seen.has(text.toLocaleLowerCase("es"))) {
        add({ field: "option", option, message: "Está repetida.", summary: "hay alternativas repetidas." });
      }
      seen.add(text.toLocaleLowerCase("es"));
    });

    if (!Number.isInteger(q.correctOption) || q.correctOption < 0 || q.correctOption >= q.options.length) {
      add({ field: "correct", message: "Marca la respuesta correcta.", summary: "marca la respuesta correcta." });
    }
    if (!Number.isInteger(q.points) || q.points < LIMITS.pointsMin || q.points > LIMITS.pointsMax) {
      const range = `de ${LIMITS.pointsMin} a ${LIMITS.pointsMax}`;
      add({ field: "points", message: `Puntaje ${range}.`, summary: `el puntaje va ${range}.` });
    }
  });
  return issues;
}
