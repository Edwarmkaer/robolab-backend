import { Navigate, Route, Routes } from "react-router-dom";
import { ErrorBoundary } from "../../shared/ui/ErrorBoundary";
import { GamePage } from "./GamePage";
import { StudentHome } from "./StudentHome";
import { StudentLogin } from "./StudentLogin";
import { useStudentToken } from "./session";

export function StudentApp() {
  const [token, setToken] = useStudentToken();

  if (!token) return <StudentLogin onSignedIn={setToken} />;

  return (
    <ErrorBoundary
      fallback={(message, reset) => (
        <main className="hero kid">
          <div className="card stack" style={{ textAlign: "center", maxWidth: 480 }}>
            <p className="alert alert-error">{message}</p>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => {
                setToken(null);
                reset();
              }}
            >
              Volver a escribir mi código
            </button>
          </div>
        </main>
      )}
    >
      <Routes>
        <Route index element={<StudentHome token={token} onSignOut={() => setToken(null)} />} />
        <Route path="juego/:attemptId" element={<GamePage token={token} />} />
        <Route path="*" element={<Navigate to="/alumno" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}
