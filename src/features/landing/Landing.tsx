import { Link } from "react-router-dom";
import { APP_NAME } from "../../shared/brand";
import { Icon } from "../../shared/ui/Icon";

export function Landing() {
  return (
    <main className="hero">
      <div className="hero-inner">
        <img src="/robot/robot.svg" alt="" />
        <h1>{APP_NAME}</h1>
        <p className="muted">
          Evaluaciones que se juegan: los niños programan un robot con bloques y cada estrella que alcanzan
          abre una pregunta. El docente ve cómo avanza su clase.
        </p>
        <div className="choices">
          <Link className="choice" to="/alumno">
            <strong>
              <Icon name="play" /> Soy alumno
            </strong>
            <span className="muted">Entra con el código que te dio tu profesora o profesor.</span>
          </Link>
          <Link className="choice" to="/docente">
            <strong>
              <Icon name="clipboard" /> Soy docente
            </strong>
            <span className="muted">Crea evaluaciones y mira el avance de tus clases.</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
