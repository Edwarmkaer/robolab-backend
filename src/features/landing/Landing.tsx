import { Link } from "react-router-dom";

export function Landing() {
  return (
    <main className="hero">
      <div className="hero-inner">
        <img src="/robot/robot.svg" alt="" />
        <h1>Inrobit Aula</h1>
        <p className="muted">
          Evaluaciones que se juegan: los niños programan un robot con bloques y cada estrella que alcanzan
          abre una pregunta. El docente ve cómo avanza su clase.
        </p>
        <div className="choices">
          <Link className="choice" to="/alumno">
            <strong>Soy alumno</strong>
            <span className="muted">Entra con el código que te dio tu profesora o profesor.</span>
          </Link>
          <Link className="choice" to="/docente">
            <strong>Soy docente</strong>
            <span className="muted">Crea evaluaciones y mira el avance de tus clases.</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
