import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { formatDuration } from "../../domain/evaluation/scoring";
import { userMessage } from "../../shared/errors";
import { Icon } from "../../shared/ui/Icon";
import { speak } from "./speech";

const cheer = (percent: number) =>
  percent >= 80 ? "¡Excelente trabajo!" : percent >= 50 ? "¡Muy bien! Sigue practicando." : "¡Buen intento! La próxima saldrá mejor.";

export function ResultView({ token, attemptId }: { token: string; attemptId: Id<"attempts"> }) {
  const result = useQuery(api.student.result, { token, attemptId });
  const retry = useMutation(api.student.retry);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const percent = result?.percent;

  useEffect(() => {
    if (percent !== undefined) speak(cheer(percent));
  }, [percent]);

  if (result === undefined) return <p className="muted">Calculando tu resultado…</p>;
  if (result === null) return <p className="muted">Todavía no terminas esta evaluación.</p>;

  async function tryAgain() {
    if (!result) return;
    setBusy(true);
    setError(null);
    try {
      const next = await retry({ token, evaluationId: result.evaluationId });
      navigate(`/alumno/juego/${next}`);
    } catch (e) {
      setError(userMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card stack kid" style={{ textAlign: "center", maxWidth: 560, margin: "0 auto" }}>
      <div className="result-robot">
        <img src="/robot/robot-exito.svg" alt="" />
      </div>
      {result.number > 1 && <span className="badge" style={{ justifySelf: "center" }}>Intento {result.number}</span>}
      <h1>{cheer(result.percent)}</h1>
      <div className="result-score">
        {result.score}
        <span className="muted" style={{ fontSize: "0.4em" }}>
          {" "}
          / {result.maxScore}
        </span>
      </div>
      <p>
        Tiempo total: <strong>{formatDuration(result.totalMs)}</strong> · Ejecutaste el robot{" "}
        <strong>
          {result.runs} {result.runs === 1 ? "vez" : "veces"}
        </strong>
      </p>
      <div className="row" style={{ justifyContent: "center" }} aria-label="Tus respuestas">
        {result.answers.map((a) => (
          <span
            key={a.stage}
            className={a.isCorrect ? "badge badge-ok" : "badge badge-warn"}
            title={`Respondiste en ${formatDuration(a.responseMs)}`}
          >
            <Icon name={a.isCorrect ? "check" : "x"} size={14} />
            Pregunta {a.stage + 1} · {formatDuration(a.responseMs)}
            <span className="sr-only">{a.isCorrect ? ", correcta" : ", incorrecta"}</span>
          </span>
        ))}
      </div>
      {error && (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      )}
      <div className="row" style={{ justifyContent: "center" }}>
        <button className="btn btn-primary" type="button" onClick={() => void tryAgain()} disabled={busy} aria-busy={busy}>
          <Icon name="rotate" /> Intentar de nuevo
        </button>
        <Link className="btn" to="/alumno">
          Terminar
        </Link>
      </div>
    </section>
  );
}
