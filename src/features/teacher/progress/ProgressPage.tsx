import { useQuery } from "convex/react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { shortLabel } from "../../../domain/evaluation/calendar";
import { formatDuration } from "../../../domain/evaluation/scoring";
import { type ChartSeries, ProgressChart } from "./ProgressChart";

// Colores validados para daltonismo (azul y naranja), con línea punteada como segunda codificación.
const STUDENT_COLOR = "#2a78d6";
const AVERAGE_COLOR = "#eb6834";

function ClassProgress({ classroomId }: { classroomId: Id<"classrooms"> }) {
  const progress = useQuery(api.analytics.classProgress, { classroomId });
  const [studentId, setStudentId] = useState<string>("");

  if (progress === undefined) return <p className="muted">Cargando…</p>;
  if (progress.evaluations.length === 0) {
    return (
      <p className="empty">
        Esta clase todavía no tiene evaluaciones. <Link to="/docente/evaluaciones/nueva">Crea una</Link>.
      </p>
    );
  }

  const student = progress.students.find((s) => s.studentId === studentId) ?? null;
  const series: ChartSeries[] = [
    {
      id: "average",
      label: "Promedio de la clase",
      shortLabel: "Promedio",
      color: AVERAGE_COLOR,
      dashed: true,
      values: progress.evaluations.map((e) => e.average),
    },
  ];
  if (student) {
    series.unshift({
      id: student.studentId,
      label: student.displayName,
      color: STUDENT_COLOR,
      values: student.series.map((p) => p.percent),
    });
  }

  return (
    <div className="stack">
      <section className="card stack">
        <div className="row spread">
          <h3>Desarrollo del aprendizaje</h3>
          <div className="field" style={{ minWidth: 220 }}>
            <label htmlFor="student">Comparar con</label>
            <select id="student" className="select" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              <option value="">Solo el promedio</option>
              {progress.students.map((s) => (
                <option key={s.studentId} value={s.studentId}>
                  {s.displayName}
                </option>
              ))}
            </select>
          </div>
        </div>
        <ProgressChart
          title={`Porcentaje de logro por evaluación, ${progress.classroomLabel}`}
          xLabels={progress.evaluations.map((e) => shortLabel(e.date))}
          xDetails={progress.evaluations.map((e) => `${shortLabel(e.date)} · ${e.title}`)}
          series={series}
        />
        <p className="small muted">Porcentaje del puntaje máximo de cada evaluación. Pasa el cursor sobre una fecha para ver el detalle.</p>
      </section>

      <section className="card stack">
        <h3>Detalle por alumno</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Alumno</th>
                {progress.evaluations.map((e) => (
                  <th key={e.evaluationId} title={e.title}>
                    {shortLabel(e.date)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {progress.students.map((s) => (
                <tr key={s.studentId}>
                  <td>
                    <button className="btn btn-ghost" type="button" style={{ padding: 0, minHeight: 0 }} onClick={() => setStudentId(s.studentId)}>
                      {s.displayName}
                    </button>
                  </td>
                  {s.series.map((p) => (
                    <td key={p.evaluationId}>
                      {p.percent === null ? (
                        <span className="muted">—</span>
                      ) : (
                        <>
                          <strong>{p.percent}%</strong>{" "}
                          <span className="small muted">{p.totalMs === null ? "" : formatDuration(p.totalMs)}</span>
                        </>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td>
                  <strong>Promedio</strong>
                </td>
                {progress.evaluations.map((e) => (
                  <td key={e.evaluationId}>
                    <strong>{e.average === null ? "—" : `${e.average}%`}</strong>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export function ProgressPage() {
  const classes = useQuery(api.classrooms.listMine);
  const [classroomId, setClassroomId] = useState<string>("");

  if (classes === undefined) return <p className="muted">Cargando…</p>;
  if (classes.length === 0) {
    return (
      <p className="empty">
        Primero <Link to="/docente/clases">crea una clase</Link>.
      </p>
    );
  }
  const selected = classroomId || classes[0]!._id;

  return (
    <div className="stack">
      <div className="row spread">
        <h2>Progreso</h2>
        <select className="select" style={{ maxWidth: 360 }} value={selected} onChange={(e) => setClassroomId(e.target.value)} aria-label="Clase">
          {classes.map((c) => (
            <option key={c._id} value={c._id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <ClassProgress key={selected} classroomId={selected as Id<"classrooms">} />
    </div>
  );
}
