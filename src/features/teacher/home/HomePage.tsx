import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../../../../convex/_generated/api";
import { localCalendarDate } from "../../../domain/evaluation/calendar";
import { Icon } from "../../../shared/ui/Icon";

const longDate = new Intl.DateTimeFormat("es-PE", { weekday: "long", day: "numeric", month: "long" });
const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase("es") + text.slice(1);

export function HomePage() {
  const today = localCalendarDate();
  const me = useQuery(api.users.me);
  const classes = useQuery(api.classrooms.listMine);
  const todays = useQuery(api.evaluations.listForDate, { date: today });
  const firstName = me?.name.trim().split(" ")[0];

  return (
    <div className="stack" style={{ gap: 28 }}>
      <div className="page-head">
        <div>
          <h2>{firstName ? `Hola, ${firstName}` : "Hola"}</h2>
          <p className="muted">{capitalize(longDate.format(new Date()))}</p>
        </div>
        <Link className="btn btn-primary" to="/docente/evaluaciones/nueva">
          <Icon name="plus" /> Nueva evaluación
        </Link>
      </div>

      <section className="stack" aria-labelledby="today-title">
        <h3 id="today-title">Evaluaciones de hoy</h3>
        {todays === undefined ? (
          <p className="muted">Cargando…</p>
        ) : todays.length === 0 ? (
          <div className="empty">
            <Icon name="calendar" size={32} />
            <p>No tienes evaluaciones programadas para hoy.</p>
            <Link className="btn" to="/docente/evaluaciones/nueva">
              <Icon name="plus" /> Programar una
            </Link>
          </div>
        ) : (
          <div className="grid-cards">
            {todays.map((e) => {
              const share = e.studentCount === 0 ? 0 : Math.round((e.finishedCount / e.studentCount) * 100);
              return (
                <Link key={e._id} className="card card-link" to={`/docente/evaluaciones/${e._id}`}>
                  <div className="row spread">
                    <strong>{e.title}</strong>
                    {e.startedCount > e.finishedCount && <span className="live">En vivo</span>}
                  </div>
                  <span className="muted small">{e.classroomLabel}</span>
                  <div className="meter" role="img" aria-label={`${share} % de la clase terminó`}>
                    <span style={{ width: `${share}%` }} />
                  </div>
                  <span className="small">
                    <strong>{e.finishedCount}</strong> de {e.studentCount} terminaron
                    {e.startedCount > e.finishedCount && ` · ${e.startedCount - e.finishedCount} jugando`}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="stack" aria-labelledby="classes-title">
        <div className="row spread">
          <h3 id="classes-title" style={{ margin: 0 }}>
            Mis clases
          </h3>
          <Link className="link-btn" to="/docente/clases">
            Administrar clases <Icon name="chevronRight" size={18} />
          </Link>
        </div>
        {classes === undefined ? (
          <p className="muted">Cargando…</p>
        ) : classes.length === 0 ? (
          <div className="empty">
            <Icon name="users" size={32} />
            <p>Todavía no tienes clases. Crea la primera y agrega a tus alumnos.</p>
            <Link className="btn btn-primary" to="/docente/clases">
              <Icon name="plus" /> Crear clase
            </Link>
          </div>
        ) : (
          <div className="grid-cards">
            {classes.map((c) => (
              <Link key={c._id} className="card card-link" to={`/docente/clases/${c._id}`}>
                <strong>{c.label}</strong>
                <span className="muted small row" style={{ gap: 6 }}>
                  <Icon name="users" size={16} /> {c.studentCount} {c.studentCount === 1 ? "alumno" : "alumnos"}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
