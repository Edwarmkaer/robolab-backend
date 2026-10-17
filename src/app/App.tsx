import { Navigate, Route, Routes } from "react-router-dom";
import { ChallengeListPage } from "../features/explore/ChallengeListPage";
import { ChallengeRoute } from "../features/explore/ChallengePage";
import { MyProgressPage } from "../features/explore/MyProgressPage";
import { TopicPage } from "../features/explore/TopicPage";
import { Landing } from "../features/landing/Landing";
import { StudentApp } from "../features/student/StudentApp";
import { TeacherApp } from "../features/teacher/TeacherApp";
import { ConnectionBanner } from "../shared/ui/ConnectionBanner";

export function App() {
  return (
    <>
      <ConnectionBanner />
      <Routes>
        {/* Modo abierto: retos sin cuenta. */}
        <Route path="/" element={<Landing />} />
        <Route path="/explorar" element={<Navigate to="/" replace />} />
        <Route path="/explorar/:topic" element={<TopicPage />} />
        <Route path="/explorar/:topic/:level" element={<ChallengeListPage />} />
        <Route path="/reto/:id" element={<ChallengeRoute />} />
        <Route path="/mi-avance" element={<MyProgressPage />} />
        {/* Clases: evaluaciones del docente y alumnos con código. */}
        <Route path="/docente/*" element={<TeacherApp />} />
        <Route path="/alumno/*" element={<StudentApp />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
