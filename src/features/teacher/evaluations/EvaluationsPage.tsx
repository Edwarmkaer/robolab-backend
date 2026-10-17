import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../../../../convex/_generated/api";
import { localCalendarDate, shortLabel } from "../../../domain/evaluation/calendar";

export function EvaluationsPage() {
  const evaluations = useQuery(api.evaluations.listMine);
  const today = localCalendarDate();

  return (
    <div className="stack">
      <div className="row spread">
        <h2>Evaluaciones</h2>
        <Link className="btn btn-primary" to="/docente/evaluaciones/nueva">
          Nueva evaluación
        </Link>
      </div>
      {evaluations === undefined ? (
        <p className="muted">Cargando…</p>
      ) : evaluations.length === 0 ? (
        <p className="empty">Aún no creaste evaluaciones.</p>
      ) : (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Título</th>
                <th>Clase</th>
                <th>Preguntas</th>
                <th>Terminaron</th>
              </tr>
            </thead>
            <tbody>
              {evaluations.map((e) => (
                <tr key={e._id}>
                  <td>
                    {shortLabel(e.scheduledDate)} {e.scheduledDate === today && <span className="badge">Hoy</span>}
                  </td>
                  <td>
                    <Link to={`/docente/evaluaciones/${e._id}`}>{e.title}</Link>
                  </td>
                  <td className="small">{e.classroomLabel}</td>
                  <td>{e.questionCount}</td>
                  <td>{e.finishedCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
