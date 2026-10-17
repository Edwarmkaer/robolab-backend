import { useQuery } from "convex/react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { localCalendarDate, shortLabel } from "../../../domain/evaluation/calendar";
import { formatDuration } from "../../../domain/evaluation/scoring";
import { Icon } from "../../../shared/ui/Icon";

const STATUS = {
  pending: { text: "Sin empezar", className: "badge badge-muted" },
  in_progress: { text: "Jugando", className: "badge badge-warn" },
  finished: { text: "Terminó", className: "badge badge-ok" },
} as const;

const LETTERS = ["A", "B", "C", "D"];

export function EvaluationDetail() {
  const { evaluationId } = useParams();
  const detail = useQuery(api.evaluations.get, { evaluationId: evaluationId as Id<"evaluations"> });

  if (detail === undefined) return <p className="muted">Cargando…</p>;

  const finished = detail.results.filter((r) => r.status === "finished");
  const playing = detail.results.some((r) => r.status === "in_progress");
  const average =
    finished.length === 0 ? null : Math.round(finished.reduce((s, r) => s + (r.percent ?? 0), 0) / finished.length);
  const isToday = detail.scheduledDate === localCalendarDate();

  return (
    <div className="stack">
      <div>
        <Link className="link-btn" to="/docente/evaluaciones">
          <Icon name="arrowLeft" size={18} /> Evaluaciones
        </Link>
      </div>
      <div className="page-head">
        <div>
          <h2>{detail.title}</h2>
          <p className="muted">
            {detail.classroomLabel} · {isToday ? "hoy" : shortLabel(detail.scheduledDate)} · {detail.questionCount}{" "}
            {detail.questionCount === 1 ? "pregunta" : "preguntas"} · {detail.maxScore} puntos
          </p>
        </div>
      </div>

      <div className="grid-cards">
        <div className="card stack-sm">
          <span className="muted small">Terminaron</span>
          <strong style={{ fontSize: "1.6rem" }}>
            {finished.length} <span className="muted small">de {detail.results.length}</span>
          </strong>
          <div className="meter" aria-hidden="true">
            <span style={{ ["--value" as string]: detail.results.length ? finished.length / detail.results.length : 0 }} />
          </div>
        </div>
        <div className="card stack-sm">
          <span className="muted small">Promedio de la clase</span>
          <strong style={{ fontSize: "1.6rem" }}>{average === null ? "—" : `${average} %`}</strong>
          <span className="small muted">De quienes ya terminaron.</span>
        </div>
      </div>

      <section className="card stack">
        <div className="row spread">
          <h3 style={{ margin: 0 }}>Resultados</h3>
          {playing ? <span className="live">En vivo</span> : <span className="small muted">Se actualiza solo.</span>}
        </div>
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
                  <td style={{ whiteSpace: "nowrap" }}>
                    {Math.min(r.stage, detail.questionCount)} de {detail.questionCount}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {r.score === null ? "—" : (
                      <>
                        <strong>{r.score}</strong> / {detail.maxScore} <span className="muted small">({r.percent ?? 0} %)</span>
                      </>
                    )}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>{r.totalMs === null ? "—" : formatDuration(r.totalMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card stack">
        <h3 style={{ margin: 0 }}>Preguntas</h3>
        <ol className="stack" style={{ paddingLeft: 0, margin: 0, listStyle: "none" }}>
          {detail.questions.map((q, qi) => (
            <li key={q._id} className="stack-sm">
              <div className="row" style={{ gap: 10, flexWrap: "nowrap", alignItems: "flex-start" }}>
                <span className="q-number">{qi + 1}</span>
                <div>
                  <strong>{q.prompt}</strong> <span className="small muted">· {q.points} {q.points === 1 ? "punto" : "puntos"}</span>
                </div>
              </div>
              <div className="row" style={{ gap: 8, paddingLeft: 40 }}>
                {q.options.map((o, i) => (
                  <span key={i} className={i === q.correctOption ? "badge badge-ok" : "badge badge-muted"}>
                    {i === q.correctOption && <Icon name="check" size={14} />}
                    {LETTERS[i]}. {o}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
