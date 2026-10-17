import { useMutation, useQuery } from "convex/react";
import { useReducer, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { editorReducer, emptyEditor } from "../../domain/game/editor";
import { type Feedback, feedbackFor } from "../../domain/game/feedback";
import { type EducationLevel, policyFor } from "../../domain/game/levels";
import type { Outcome } from "../../domain/game/simulator";
import { userMessage } from "../../shared/errors";
import { BlockEditor } from "../game/BlockEditor";
import { Board } from "../game/Board";
import { STEP_MS, useRunner } from "../game/useRunner";
import { type PublicQuestion, QuestionDialog } from "./QuestionDialog";
import { ResultView } from "./ResultView";
import { speak } from "./speech";

type Stage = { level: EducationLevel; stage: number; questionCount: number };

function StageView({
  token,
  attemptId,
  stage,
  pendingQuestion,
}: {
  token: string;
  attemptId: Id<"attempts">;
  stage: Stage;
  pendingQuestion: PublicQuestion | null;
}) {
  const policy = policyFor(stage.level);
  const map = policy.mapFor(stage.stage);
  const reachObjective = useMutation(api.student.reachObjective);
  const answer = useMutation(api.student.answer);
  const [editor, dispatch] = useReducer(editorReducer, emptyEditor);
  const [runs, setRuns] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [question, setQuestion] = useState<PublicQuestion | null>(pendingQuestion);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFinish(outcome: Outcome) {
    const fb = feedbackFor(outcome);
    setFeedback(fb);
    speak(`${fb.title} ${fb.detail}`);
    if (outcome.kind !== "GOAL") return;
    try {
      setQuestion(await reachObjective({ token, attemptId, program: editor.blocks }));
    } catch (e) {
      setError(userMessage(e));
    }
  }

  const { state: runner, run, reset } = useRunner(map, (outcome) => void onFinish(outcome));

  function onRun() {
    setError(null);
    setFeedback(null);
    setRuns((n) => n + 1);
    run(editor.blocks);
  }

  async function onAnswer(option: number) {
    setBusy(true);
    try {
      await answer({ token, attemptId, chosenOption: option, program: editor.blocks, runs: Math.max(runs, 1) });
      // El servidor avanza la etapa; la consulta reactiva monta la siguiente.
    } catch (e) {
      setError(userMessage(e));
      setBusy(false);
    }
  }

  const mood = runner.outcome?.kind === "GOAL" ? "success" : runner.outcome?.kind === "OFF_PATH" ? "error" : "idle";
  const highlight = runner.activePath
    ? { path: runner.activePath, tone: "active" as const }
    : runner.errorPath
      ? { path: runner.errorPath, tone: "error" as const }
      : null;

  return (
    <div className="game">
      <div className="stack">
        <Board map={map} robot={runner.robot} mood={mood} stepMs={STEP_MS} />
        {feedback && (
          <p className="feedback" data-tone={feedback.tone} role="status">
            {feedback.title} {feedback.detail}
          </p>
        )}
        {error && <p className="alert alert-error">{error}</p>}
      </div>
      <div className="stack">
        <BlockEditor policy={policy} state={editor} dispatch={dispatch} disabled={runner.running || question !== null} active={highlight} />
        <div className="row">
          <button
            className="btn btn-primary"
            type="button"
            style={{ flex: 1 }}
            disabled={runner.running || editor.blocks.length === 0 || question !== null}
            onClick={onRun}
          >
            ▶ Ejecutar
          </button>
          <button
            className="btn"
            type="button"
            disabled={runner.running}
            onClick={() => {
              dispatch({ type: "clear" });
              setFeedback(null);
              reset();
            }}
          >
            Borrar
          </button>
        </div>
      </div>
      {question && <QuestionDialog question={question} busy={busy} onAnswer={(o) => void onAnswer(o)} />}
    </div>
  );
}

export function GamePage({ token }: { token: string }) {
  const { attemptId } = useParams();
  const id = attemptId as Id<"attempts">;
  const attempt = useQuery(api.student.attempt, { token, attemptId: id });

  if (attempt === undefined) return <p className="page muted">Cargando…</p>;

  return (
    <main className="page kid stack">
      <div className="row spread">
        <Link className="brand" to="/alumno">
          <img src="/robot/robot.svg" alt="" />
          {attempt.title}
        </Link>
        <div className="progress-dots" aria-label={`Estrella ${Math.min(attempt.stage + 1, attempt.questionCount)} de ${attempt.questionCount}`}>
          {Array.from({ length: attempt.questionCount }, (_, i) => (
            <span key={i} data-state={i < attempt.stage ? "done" : i === attempt.stage ? "current" : "next"} />
          ))}
        </div>
      </div>
      {attempt.finished ? (
        <ResultView token={token} attemptId={id} />
      ) : (
        <StageView
          // Una etapa nueva monta un editor y un tablero nuevos.
          key={attempt.stage}
          token={token}
          attemptId={id}
          stage={{ level: attempt.level, stage: attempt.stage, questionCount: attempt.questionCount }}
          pendingQuestion={attempt.pendingQuestion}
        />
      )}
    </main>
  );
}
