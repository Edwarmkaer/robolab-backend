import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../../../../convex/_generated/api";
import { localCalendarDate } from "../../../domain/evaluation/calendar";

export function HomePage() {
  const today = localCalendarDate();
  const classes = useQuery(api.classrooms.listMine);
  const todays = useQuery(api.evaluations.listForDate, { date: today });

  return (
    <div className="stack">
      <section className="stack">
        <div className="row spread">
          <h2>Evaluaciones de hoy</h2>
          <Link className="btn btn-primary" to="/docente/evaluaciones/nueva">
            Nueva evaluación
          </Link>
        </div>
        {todays === undefined ? (
          <p className="muted">Cargando…</p>
        ) : todays.length === 0 ? (
          <p className="empty">No tienes evaluaciones programadas para hoy.</p>
        ) : (
          <div className="grid-cards">
            {todays.map((e) => (
              <Link key={e._id} className="card stack choice" to={`/docente/evaluaciones/${e._id}`}>
                <strong>{e.title}</strong>
                <span className="muted small">{e.classroomLabel}</span>
                <span className="badge">
                  {e.finishedCount} terminaron · {e.startedCount - e.finishedCount} en curso
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="stack">
        <div className="row spread">
          <h2>Mis clases</h2>
          <Link className="btn" to="/docente/clases">
            Administrar clases
          </Link>
        </div>
        {classes === undefined ? (
          <p className="muted">Cargando…</p>
        ) : classes.length === 0 ? (
          <p className="empty">
            Todavía no tienes clases. <Link to="/docente/clases">Crea la primera</Link> y agrega a tus alumnos.
          </p>
        ) : (
          <div className="grid-cards">
            {classes.map((c) => (
              <Link key={c._id} className="card stack choice" to={`/docente/clases/${c._id}`}>
                <strong>{c.label}</strong>
                <span className="muted small">{c.studentCount} alumnos</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
