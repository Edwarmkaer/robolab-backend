import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../../../../convex/_generated/api";
import { localCalendarDate, shortLabel } from "../../../domain/evaluation/calendar";
import { Icon } from "../../../shared/ui/Icon";

export function EvaluationsPage() {
  const evaluations = useQuery(api.evaluations.listMine);
  const today = localCalendarDate();

  return (
    <div className="stack">
      <div className="page-head">
        <h2>Evaluaciones</h2>
        <Link className="btn btn-primary" to="/docente/evaluaciones/nueva">
          <Icon name="plus" /> Nueva evaluación
        </Link>
      </div>
      {evaluations === undefined ? (
        <p className="muted">Cargando…</p>
      ) : evaluations.length === 0 ? (
        <div className="empty">
          <Icon name="clipboard" size={32} />
          <p>Aún no creaste evaluaciones. Cada pregunta aparece cuando el robot llega a una estrella.</p>
          <Link className="btn btn-primary" to="/docente/evaluaciones/nueva">
            <Icon name="plus" /> Crear la primera
          </Link>
        </div>
      ) : (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Día</th>
                <th>Título</th>
                <th>Clase</th>
                <th>Preguntas</th>
                <th>Terminaron</th>
                <th>
                  <span className="sr-only">Ver</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {evaluations.map((e) => (
                <tr key={e._id}>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {shortLabel(e.scheduledDate)} {e.scheduledDate === today && <span className="badge">Hoy</span>}
                  </td>
                  <td>
                    <Link className="row-link" to={`/docente/evaluaciones/${e._id}`}>
                      {e.title}
                    </Link>
                  </td>
                  <td className="small">{e.classroomLabel}</td>
                  <td>{e.questionCount}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {e.finishedCount} de {e.studentCount}
                  </td>
                  <td style={{ width: 48, textAlign: "right" }}>
                    <Link
                      className="icon-btn"
                      to={`/docente/evaluaciones/${e._id}`}
                      aria-label={`Ver resultados de ${e.title}`}
                      data-tooltip="Ver resultados"
                    >
                      <Icon name="eye" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
