import { useAuthActions } from "@convex-dev/auth/react";
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { Link, NavLink, Navigate, Route, Routes } from "react-router-dom";
import { TeacherAuth } from "./TeacherAuth";
import { ClassesPage } from "./classes/ClassesPage";
import { EvaluationDetail } from "./evaluations/EvaluationDetail";
import { EvaluationForm } from "./evaluations/EvaluationForm";
import { EvaluationsPage } from "./evaluations/EvaluationsPage";
import { HomePage } from "./home/HomePage";
import { ProgressPage } from "./progress/ProgressPage";

const TABS = [
  { to: "/docente", label: "Inicio", end: true },
  { to: "/docente/clases", label: "Mis clases", end: false },
  { to: "/docente/evaluaciones", label: "Evaluaciones", end: false },
  { to: "/docente/progreso", label: "Progreso", end: false },
];

function TeacherShell() {
  const { signOut } = useAuthActions();
  return (
    <div className="page">
      <header className="topbar">
        <Link className="brand" to="/docente">
          <img src="/robot/robot.svg" alt="" />
          Inrobit Aula
        </Link>
        <button className="btn btn-ghost" type="button" onClick={() => void signOut()}>
          Cerrar sesión
        </button>
      </header>
      <nav className="tabs" aria-label="Secciones del docente">
        {TABS.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={tab.end} className="tab">
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <Routes>
        <Route index element={<HomePage />} />
        <Route path="clases" element={<ClassesPage />} />
        <Route path="clases/:classroomId" element={<ClassesPage />} />
        <Route path="evaluaciones" element={<EvaluationsPage />} />
        <Route path="evaluaciones/nueva" element={<EvaluationForm />} />
        <Route path="evaluaciones/:evaluationId" element={<EvaluationDetail />} />
        <Route path="progreso" element={<ProgressPage />} />
        <Route path="*" element={<Navigate to="/docente" replace />} />
      </Routes>
    </div>
  );
}

export function TeacherApp() {
  return (
    <>
      <AuthLoading>
        <p className="page muted">Cargando…</p>
      </AuthLoading>
      <Unauthenticated>
        <TeacherAuth />
      </Unauthenticated>
      <Authenticated>
        <TeacherShell />
      </Authenticated>
    </>
  );
}
