import { useAuthActions } from "@convex-dev/auth/react";
import { Authenticated, AuthLoading, Unauthenticated, useQuery } from "convex/react";
import { Link, NavLink, Navigate, Route, Routes } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import { APP_NAME } from "../../shared/brand";
import { type IconName, Icon } from "../../shared/ui/Icon";
import { IconButton } from "../../shared/ui/IconButton";
import { TeacherAuth } from "./auth/TeacherAuth";
import { ClassesPage } from "./classes/ClassesPage";
import { EvaluationDetail } from "./evaluations/EvaluationDetail";
import { EvaluationForm } from "./evaluations/EvaluationForm";
import { EvaluationsPage } from "./evaluations/EvaluationsPage";
import { HomePage } from "./home/HomePage";
import { ProgressPage } from "./progress/ProgressPage";

const TABS: readonly { to: string; label: string; icon: IconName; end: boolean }[] = [
  { to: "/docente", label: "Inicio", icon: "home", end: true },
  { to: "/docente/clases", label: "Mis clases", icon: "users", end: false },
  { to: "/docente/evaluaciones", label: "Evaluaciones", icon: "clipboard", end: false },
  { to: "/docente/progreso", label: "Progreso", icon: "chart", end: false },
];

function TeacherShell() {
  const { signOut } = useAuthActions();
  const me = useQuery(api.users.me);
  const initial = me?.name.trim().charAt(0).toUpperCase() ?? "";

  return (
    <div className="page has-bottom-nav">
      <header className="topbar">
        <Link className="brand" to="/docente">
          <img src="/robot/robot.svg" alt="" />
          {APP_NAME}
        </Link>
        <div className="user-chip">
          {me && (
            <>
              <span className="avatar" aria-hidden="true">
                {initial}
              </span>
              <span className="user-name small" title={me.email}>
                {me.name}
              </span>
            </>
          )}
          <IconButton icon="logOut" label="Cerrar sesión" onClick={() => void signOut()} />
        </div>
      </header>
      <nav className="tabs" aria-label="Secciones del docente">
        {TABS.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={tab.end} className="tab">
            <Icon name={tab.icon} />
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
