import { Link } from "react-router-dom";
import { APP_NAME } from "../../shared/brand";
import { Icon } from "../../shared/ui/Icon";

/** Portada: aquí se elige el rol, también al cerrar sesión. */
export function Landing() {
  return (
    <main className="hero">
      <div className="hero-inner">
        <div className="robot-badge">
          <img src="/robot/robot.svg" alt="" />
        </div>
        <h1>{APP_NAME}</h1>
        <p className="muted">
          Evaluaciones que se juegan: los niños programan un robot con bloques y cada estrella que alcanzan
          abre una pregunta. El docente ve cómo avanza su clase.
        </p>
        <h2 className="choices-title">¿Quién eres?</h2>
        <div className="choices">
          <Link className="choice" to="/alumno">
            <img className="choice-img" src="/roles/alumno.svg" alt="" />
            <strong>Soy alumno</strong>
            <span className="muted">Entra con el código que te dio tu profesora o profesor.</span>
            <span className="choice-go" aria-hidden="true">
              <Icon name="chevronRight" />
            </span>
          </Link>
          <Link className="choice" to="/docente">
            <img className="choice-img" src="/roles/docente.svg" alt="" />
            <strong>Soy docente</strong>
            <span className="muted">Crea evaluaciones y mira el avance de tus clases.</span>
            <span className="choice-go" aria-hidden="true">
              <Icon name="chevronRight" />
            </span>
          </Link>
        </div>
      </div>
    </main>
  );
}
