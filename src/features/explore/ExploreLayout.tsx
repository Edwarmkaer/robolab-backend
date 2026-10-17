import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import type { Topic } from "../../domain/explore/challenges";
import type { EducationLevel } from "../../domain/game/levels";
import { APP_NAME } from "../../shared/brand";

/** Color de cada tópico (la línea bajo la tarjeta y su barra de avance). */
export const TOPIC_COLOR: Record<Topic, string> = {
  ciencia: "#1f8a4c",
  tecnologia: "#2f6fdc",
  ingenieria: "#d9822b",
  artes: "#8e5bd8",
  matematicas: "#e0604f",
};

export const LEVEL_INFO: Record<EducationLevel, { name: string; ages: string; description: string; dots: number }> = {
  inicial: { name: "Inicial", ages: "3-5 años", description: "Primeros pasos: avanzar y girar.", dots: 1 },
  primaria: { name: "Primaria", ages: "6-11 años", description: "Retos con más pasos, Repetir y razonamiento.", dots: 2 },
  secundaria: { name: "Secundaria", ages: "12-16 años", description: "Variables, optimización y modelos.", dots: 3 },
};

/** Cabecera del modo abierto: se juega sin cuenta. */
export function ExploreLayout({ children }: { children: ReactNode }) {
  return (
    <div className="explore">
      <header className="explore-header">
        <div className="explore-header-inner">
          <Link className="brand" to="/">
            <img src="/robot/robot.svg" alt="" />
            {APP_NAME}
          </Link>
          <nav className="explore-nav" aria-label="Secciones">
            <NavLink to="/" end>
              Explorar retos
            </NavLink>
            <NavLink to="/mi-avance">Mi avance</NavLink>
            <NavLink to="/alumno">Unirme a una clase</NavLink>
          </nav>
          <Link className="btn btn-sm" to="/docente">
            Soy docente
          </Link>
        </div>
      </header>
      <main className="explore-main">{children}</main>
    </div>
  );
}

export function Breadcrumbs({ items }: { items: readonly { label: string; to?: string }[] }) {
  return (
    <nav className="breadcrumbs" aria-label="Estás en">
      {items.map((item, i) => (
        <span key={item.label}>
          {i > 0 && <span aria-hidden="true"> › </span>}
          {item.to ? <Link to={item.to}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}
