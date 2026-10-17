import type { FinishedAttempt } from "../../domain/evaluation/ranking";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

/** Los intentos anteriores a los reintentos no guardaban su número: son la vez 1. */
export const attemptNumber = (attempt: Pick<Doc<"attempts">, "number">) => attempt.number ?? 1;

/** Todos los intentos de un alumno en una evaluación, del primero al último. */
export async function attemptsOf(ctx: QueryCtx, studentId: Id<"students">, evaluationId: Id<"evaluations">) {
  const attempts = await ctx.db
    .query("attempts")
    .withIndex("by_student_evaluation", (q) => q.eq("studentId", studentId).eq("evaluationId", evaluationId))
    .collect();
  return attempts.sort((a, b) => attemptNumber(a) - attemptNumber(b) || a._creationTime - b._creationTime);
}

export async function runsOf(ctx: QueryCtx, attemptId: Id<"attempts">, stage: number) {
  return await ctx.db
    .query("runs")
    .withIndex("by_attempt_stage", (q) => q.eq("attemptId", attemptId).eq("stage", stage))
    .collect();
}

/** Ejecuciones de un intento terminado (los antiguos se suman desde sus respuestas). */
async function totalRunsOf(ctx: QueryCtx, attempt: Doc<"attempts">): Promise<number> {
  if (attempt.totalRuns !== undefined) return attempt.totalRuns;
  const answers = await ctx.db
    .query("answers")
    .withIndex("by_attempt", (q) => q.eq("attemptId", attempt._id))
    .collect();
  return answers.reduce((sum, a) => sum + a.runs, 0);
}

/** Los intentos terminados en el formato del ranking. */
export async function finishedAttempts(ctx: QueryCtx, attempts: readonly Doc<"attempts">[]): Promise<FinishedAttempt[]> {
  const finished = attempts.filter((a) => a.finishedAt !== undefined && a.score !== undefined);
  return await Promise.all(
    finished.map(async (a) => ({
      number: attemptNumber(a),
      score: a.score ?? 0,
      percent: a.percent ?? 0,
      runs: await totalRunsOf(ctx, a),
      totalMs: a.totalMs ?? 0,
    })),
  );
}

/** Intentos de una evaluación agrupados por alumno. */
export function groupByStudent(attempts: readonly Doc<"attempts">[]) {
  const byStudent = new Map<Id<"students">, Doc<"attempts">[]>();
  for (const a of attempts) byStudent.set(a.studentId, [...(byStudent.get(a.studentId) ?? []), a]);
  for (const list of byStudent.values()) list.sort((a, b) => attemptNumber(a) - attemptNumber(b));
  return byStudent;
}
