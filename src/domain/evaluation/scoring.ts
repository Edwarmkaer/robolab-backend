/**
 * Calificación de una evaluación. Función pura: el servidor la usa para
 * calcular la nota, y el navegador nunca recibe las respuestas correctas.
 */

export type QuestionKey = {
  readonly questionId: string;
  readonly correctOption: number;
  readonly points: number;
};

export type AnswerRecord = {
  readonly questionId: string;
  readonly chosenOption: number;
  /** Momento en que se mostró la pregunta (ms desde epoch, hora del servidor). */
  readonly shownAt: number;
  readonly answeredAt: number;
};

export type GradedAnswer = AnswerRecord & {
  readonly isCorrect: boolean;
  readonly pointsAwarded: number;
  readonly responseMs: number;
};

export type EvaluationResult = {
  readonly score: number;
  readonly maxScore: number;
  readonly correctCount: number;
  readonly questionCount: number;
  /** Porcentaje entero de 0 a 100. */
  readonly percent: number;
  readonly totalMs: number;
  readonly averageResponseMs: number;
  readonly answers: readonly GradedAnswer[];
};

export class ScoringError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScoringError";
  }
}

export function gradeAnswer(key: QuestionKey, answer: AnswerRecord): GradedAnswer {
  if (key.questionId !== answer.questionId) {
    throw new ScoringError("La respuesta no corresponde a la pregunta.");
  }
  if (answer.answeredAt < answer.shownAt) {
    throw new ScoringError("La respuesta es anterior a la pregunta.");
  }
  const isCorrect = answer.chosenOption === key.correctOption;
  return {
    ...answer,
    isCorrect,
    pointsAwarded: isCorrect ? key.points : 0,
    responseMs: answer.answeredAt - answer.shownAt,
  };
}

/**
 * @param startedAt inicio del intento; `finishedAt` su fin. El tiempo total
 * incluye el minijuego, no solo las respuestas.
 */
export function gradeEvaluation(
  keys: readonly QuestionKey[],
  answers: readonly AnswerRecord[],
  startedAt: number,
  finishedAt: number,
): EvaluationResult {
  if (finishedAt < startedAt) throw new ScoringError("El intento termina antes de empezar.");
  const byId = new Map(answers.map((a) => [a.questionId, a]));
  const graded: GradedAnswer[] = [];
  for (const key of keys) {
    const answer = byId.get(key.questionId);
    if (answer) graded.push(gradeAnswer(key, answer));
  }
  const score = graded.reduce((sum, a) => sum + a.pointsAwarded, 0);
  const maxScore = keys.reduce((sum, k) => sum + k.points, 0);
  const totalResponse = graded.reduce((sum, a) => sum + a.responseMs, 0);
  return {
    score,
    maxScore,
    correctCount: graded.filter((a) => a.isCorrect).length,
    questionCount: keys.length,
    percent: maxScore === 0 ? 0 : Math.round((score / maxScore) * 100),
    totalMs: finishedAt - startedAt,
    averageResponseMs: graded.length === 0 ? 0 : Math.round(totalResponse / graded.length),
    answers: graded,
  };
}

/** "1 min 05 s" o "42 s". Pensado para docentes y alumnos. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds} s`;
  return `${minutes} min ${String(seconds).padStart(2, "0")} s`;
}
