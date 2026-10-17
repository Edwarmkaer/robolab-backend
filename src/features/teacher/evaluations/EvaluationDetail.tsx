import { useQuery } from "convex/react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { shortLabel } from "../../../domain/evaluation/calendar";
import { formatDuration } from "../../../domain/evaluation/scoring";

const STATUS = {
  pending: { text: "Sin empezar", className: "badge" },
  in_progress: { text: "Jugando", className: "badge badge-warn" },
  finished: { text: "Terminó", className: "badge badge-ok" },
} as const;

export function EvaluationDetail() {
  const { evaluationId } = useParams();
  const detail = useQuery(api.evaluations.get, { evaluationId: evaluationId as Id<"evaluations"> });

  if (detail === undefined) return <p className="muted">Cargando…</p>;

  return (
    <div className="stack">
      <div className="row spread">
        <div>
          <h2>{detail.title}</h2>
          <p className="muted">
            {detail.classroomLabel} · {shortLabel(detail.scheduledDate)} · {detail.questionCount} preguntas ·{" "}
            {detail.maxScore} puntos
          </p>
        </div>
        <Link className="btn" to="/docente/evaluaciones">
          Volver
        </Link>
      </div>

      <section className="card stack">
        <h3>Resultados en vivo</h3>
        <p className="small muted">Se actualiza solo mientras tus alumnos juegan.</p>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Alumno</th>
                <th>Estado</th>
                <th>Avance</th>
                <th>Puntaje</th>
                <th>Tiempo</th>
              </tr>
            </thead>
            <tbody>
              {detail.results.map((r) => (
                <tr key={r.studentId}>
                  <td>{r.displayName}</td>
                  <td>
                    <span className={STATUS[r.status].className}>{STATUS[r.status].text}</span>
                  </td>
                  <td>
                    {Math.min(r.stage, detail.questionCount)} / {detail.questionCount}
                  </td>
                  <td>{r.score === null ? "—" : `${r.score} / ${detail.maxScore} (${r.percent ?? 0} %)`}</td>
                  <td>{r.totalMs === null ? "—" : formatDuration(r.totalMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card stack">
        <h3>Preguntas</h3>
        <ol className="stack" style={{ paddingLeft: 20, margin: 0 }}>
          {detail.questions.map((q) => (
            <li key={q._id}>
              <strong>{q.prompt}</strong> <span className="small muted">({q.points} pts)</span>
              <ul style={{ margin: "4px 0 0" }}>
                {q.options.map((o, i) => (
                  <li key={i} style={i === q.correctOption ? { fontWeight: 800, color: "var(--c-ok)" } : undefined}>
                    {o} {i === q.correctOption && "✓"}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
