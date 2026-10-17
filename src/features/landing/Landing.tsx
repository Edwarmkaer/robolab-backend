import { Link } from "react-router-dom";
import { TOPICS } from "../../domain/explore/challenges";
import { Icon } from "../../shared/ui/Icon";
import { ExploreLayout, TOPIC_COLOR } from "../explore/ExploreLayout";

/** Portada: retos sin registrarse, y la entrada de alumnos con código y de docentes. */
export function Landing() {
  return (
    <ExploreLayout>
      <section className="stack" aria-labelledby="hero-title">
        <div>
          <h1 id="hero-title" className="hero-title">
            Resuelve retos STEAM
          </h1>
          <p className="muted">Ciencia, tecnología, ingeniería, artes y matemáticas. Sin registrarte: elige un tópico y empieza.</p>
        </div>
        <div className="topic-grid">
          {TOPICS.map((t) =>
            t.available ? (
              <Link
                key={t.id}
                className="topic-card"
                to={`/explorar/${t.id}`}
                style={{ ["--topic" as string]: TOPIC_COLOR[t.id] }}
              >
                <span className="topic-emoji" aria-hidden="true">
                  {t.emoji}
                </span>
                <strong>{t.name}</strong>
                <span className="small muted">{t.tagline}</span>
              </Link>
            ) : (
              <div
                key={t.id}
                className="topic-card"
                aria-disabled="true"
                style={{ ["--topic" as string]: TOPIC_COLOR[t.id] }}
              >
                <span className="topic-emoji" aria-hidden="true">
                  {t.emoji}
                </span>
                <strong>{t.name}</strong>
                <span className="small muted">{t.tagline}</span>
                <span className="badge badge-muted">Próximamente</span>
              </div>
            ),
          )}
        </div>
      </section>

      <section className="role-grid" aria-label="Entrar con una clase">
        <Link className="role-card" to="/alumno">
          <img src="/roles/alumno.svg" alt="" />
          <span className="stack-sm">
            <strong>¿Tu docente te dio un código?</strong>
            <span className="small muted">Entra a tu clase con tu código. No necesitas cuenta.</span>
            <span className="btn btn-primary btn-sm">
              Unirme a una clase <Icon name="chevronRight" size={18} />
            </span>
          </span>
        </Link>
        <Link className="role-card" to="/docente">
          <img src="/roles/docente.svg" alt="" />
          <span className="stack-sm">
            <strong>¿Eres docente?</strong>
            <span className="small muted">Crea evaluaciones para tu clase y sigue cómo aprende cada alumno.</span>
            <span className="btn btn-sm">
              Iniciar sesión <Icon name="chevronRight" size={18} />
            </span>
          </span>
        </Link>
      </section>
    </ExploreLayout>
  );
}
