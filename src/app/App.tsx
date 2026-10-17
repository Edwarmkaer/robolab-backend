import { Navigate, Route, Routes } from "react-router-dom";
import { Landing } from "../features/landing/Landing";
import { StudentApp } from "../features/student/StudentApp";
import { TeacherApp } from "../features/teacher/TeacherApp";
import { ConnectionBanner } from "../shared/ui/ConnectionBanner";

export function App() {
  return (
    <>
      <ConnectionBanner />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/docente/*" element={<TeacherApp />} />
        <Route path="/alumno/*" element={<StudentApp />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
