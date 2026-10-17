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
  retrying: { text: "Reintentando", className: "badge badge-warn" },
  finished: { text: "Terminó", className: "badge badge-ok" },
} as const;

const MEDALS = ["🥇", "🥈", "🥉"];

function Position({ value }: { value: number | null }) {
  if (value === null) return <span className="muted">—</span>;
  const medal = MEDALS[value - 1];
  return medal ? (
    <span className="medal" role="img" aria-label={`Puesto ${value}`}>
      {medal}
    </span>
  ) : (
    <span className="position">{value}</span>
  );
}

const LETTERS = ["A", "B", "C", "D"];

export function EvaluationDetail() {
  const { evaluationId } = useParams();
  const detail = useQuery(api.evaluations.get, { evaluationId: evaluationId as Id<"evaluations"> });

  if (detail === undefined) return <p className="muted">Cargando…</p>;

  const finished = detail.results.filter((r) => r.position !== null);
  const playing = detail.results.some((r) => r.status === "in_progress" || r.status === "retrying");
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
          <span className="small muted">Con el mejor intento de cada uno.</span>
        </div>
      </div>

      <section className="card stack">
        <div className="row spread">
          <h3 style={{ margin: 0 }}>Resultados</h3>
          {playing && <span className="live">En vivo</span>}
        </div>
        <p className="small muted">
          Orden: más puntaje; a igual puntaje, menos veces rendida, menos intentos de ejecutar y menos tiempo.
        </p>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Puesto</th>
                <th>Alumno</th>
                <th>Estado</th>
                <th>Mejor puntaje</th>
                <th title="Veces que rindió la evaluación hasta lograr su mejor puntaje">Veces</th>
                <th title="Veces que tocó Ejecutar en ese intento">Intentos</th>
                <th>Tiempo</th>
              </tr>
            </thead>
            <tbody>
              {detail.results.map((r) => (
                <tr key={r.studentId}>
                  <td>
                    <Position value={r.position} />
                  </td>
                  <td>{r.displayName}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <span className={STATUS[r.status].className}>{STATUS[r.status].text}</span>
                    {(r.status === "in_progress" || r.status === "retrying") && (
                      <span className="small muted">
                        {" "}
                        {r.attemptNumber > 1 && `vez ${r.attemptNumber} · `}estrella {Math.min(r.stage + 1, detail.questionCount)} de{" "}
                        {detail.questionCount}
                      </span>
                    )}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {r.score === null ? "—" : (
                      <>
                        <strong>{r.score}</strong> / {detail.maxScore} <span className="muted small">({r.percent ?? 0} %)</span>
                      </>
                    )}
                  </td>
                  <td>
                    {r.tries === null ? (
                      "—"
                    ) : (
                      <span title={r.totalTries > r.tries ? `La rindió ${r.totalTries} veces en total` : undefined}>
                        {r.tries}
                        {r.totalTries > r.tries && <span className="small muted"> ({r.totalTries})</span>}
                      </span>
                    )}
                  </td>
                  <td>{r.runs ?? "—"}</td>
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
