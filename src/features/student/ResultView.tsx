import { useQuery } from "convex/react";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { formatDuration } from "../../domain/evaluation/scoring";
import { Icon } from "../../shared/ui/Icon";
import { speak } from "./speech";

const cheer = (percent: number) =>
  percent >= 80 ? "¡Excelente trabajo!" : percent >= 50 ? "¡Muy bien! Sigue practicando." : "¡Buen intento! La próxima saldrá mejor.";

export function ResultView({ token, attemptId }: { token: string; attemptId: Id<"attempts"> }) {
  const result = useQuery(api.student.result, { token, attemptId });
  const percent = result?.percent;

  useEffect(() => {
    if (percent !== undefined) speak(cheer(percent));
  }, [percent]);

  if (result === undefined) return <p className="muted">Calculando tu resultado…</p>;
  if (result === null) return <p className="muted">Todavía no terminas esta evaluación.</p>;

  return (
    <section className="card stack kid" style={{ textAlign: "center", maxWidth: 560, margin: "0 auto" }}>
      <div className="result-robot">
        <img src="/robot/robot-exito.svg" alt="" />
      </div>
      <h1>{cheer(result.percent)}</h1>
      <div className="result-score">
        {result.score}
        <span className="muted" style={{ fontSize: "0.4em" }}>
          {" "}
          / {result.maxScore}
        </span>
      </div>
      <p>
        Tiempo total: <strong>{formatDuration(result.totalMs)}</strong>
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
      <Link className="btn btn-primary" to="/alumno">
        Terminar
      </Link>
    </section>
  );
}
