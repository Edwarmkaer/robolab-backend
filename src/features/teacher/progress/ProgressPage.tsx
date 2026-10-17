import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { shortLabel } from "../../../domain/evaluation/calendar";
import { Icon } from "../../../shared/ui/Icon";
import { type ChartSeries, ProgressChart } from "./ProgressChart";
import { scaleFor } from "./chartLayout";

// Colores validados para daltonismo (azul y naranja), con línea punteada como segunda codificación.
const STUDENT_COLOR = "#2a78d6";
const AVERAGE_COLOR = "#eb6834";

type Progress = FunctionReturnType<typeof api.analytics.classProgress>;
type Point = Progress["students"][number]["series"][number];
type EvaluationPoint = Progress["evaluations"][number];

const decimal = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 1 });

type Metric = {
  readonly label: string;
  readonly hint: string;
  /** Tope fijo del eje (el logro siempre llega a 100). */
  readonly fixedTop?: number;
  readonly format: (value: number) => string;
  readonly student: (point: Point) => number | null;
  readonly average: (evaluation: EvaluationPoint) => number | null;
};

/** Las medidas del desarrollo del aprendizaje: una a la vez, cada una en su escala. */
const METRICS = {
  percent: {
    label: "Logro",
    hint: "Porcentaje del puntaje máximo, con su mejor intento. Más es mejor.",
    fixedTop: 100,
    format: (v) => `${Math.round(v)}%`,
    student: (p) => p.percent,
    average: (e) => e.average,
  },
  runs: {
    label: "Intentos por estrella",
    hint: "Cuántas veces tocó «Ejecutar» para llegar a cada estrella. Menos es mejor: piensa antes de probar.",
    format: (v) => decimal.format(v),
    student: (p) => p.runsPerStar,
    average: (e) => e.averageRunsPerStar,
  },
  time: {
    label: "Tiempo",
    hint: "Minutos que le tomó la evaluación, con su mejor intento. Menos es mejor.",
    format: (v) => `${decimal.format(v)} min`,
    student: (p) => (p.totalMs === null ? null : p.totalMs / 60_000),
    average: (e) => (e.averageMs === null ? null : e.averageMs / 60_000),
  },
  tries: {
    label: "Veces que la rindió",
    hint: "Veces que rindió la evaluación hasta lograr su mejor puntaje. Menos es mejor.",
    format: (v) => decimal.format(v),
    student: (p) => p.tries,
    average: (e) => e.averageTries,
  },
} satisfies Record<string, Metric>;

type MetricKey = keyof typeof METRICS;
const METRIC_KEYS = Object.keys(METRICS) as MetricKey[];

function ClassProgress({ classroomId }: { classroomId: Id<"classrooms"> }) {
  const progress = useQuery(api.analytics.classProgress, { classroomId });
  const [studentId, setStudentId] = useState<string>("");
  const [metricKey, setMetricKey] = useState<MetricKey>("percent");

  if (progress === undefined) return <p className="muted">Cargando…</p>;
  if (progress.evaluations.length === 0) {
    return (
      <div className="empty">
        <Icon name="chart" size={32} />
        <p>Cuando esta clase rinda su primera evaluación, aquí verás cómo avanza.</p>
        <Link className="btn btn-primary" to="/docente/evaluaciones/nueva">
          <Icon name="plus" /> Crear evaluación
        </Link>
      </div>
    );
  }

  const metric: Metric = METRICS[metricKey];
  const student = progress.students.find((s) => s.studentId === studentId) ?? null;
  const averageValues = progress.evaluations.map(metric.average);
  const series: ChartSeries[] = [
    {
      id: "average",
      label: "Promedio de la clase",
      shortLabel: "Promedio",
      color: AVERAGE_COLOR,
      dashed: true,
      values: averageValues,
    },
  ];
  if (student) {
    series.unshift({
      id: student.studentId,
      label: student.displayName,
      color: STUDENT_COLOR,
      values: student.series.map(metric.student),
    });
  }
  const highest = Math.max(0, ...series.flatMap((s) => s.values.filter((v): v is number => v !== null)));
  const scale = scaleFor(highest, metric.fixedTop);

  return (
    <div className="stack">
      <section className="card stack">
        <div className="page-head" style={{ alignItems: "end" }}>
          <h3 style={{ margin: 0 }}>Desarrollo del aprendizaje</h3>
          <div className="row" style={{ alignItems: "end" }}>
            <div className="field" style={{ minWidth: 190 }}>
              <label htmlFor="metric">Medida</label>
              <select id="metric" className="select" value={metricKey} onChange={(e) => setMetricKey(e.target.value as MetricKey)}>
                {METRIC_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {METRICS[key].label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ minWidth: 190 }}>
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
        </div>
        <ProgressChart
          title={`${metric.label} por evaluación, ${progress.classroomLabel}`}
          xLabels={progress.evaluations.map((e) => shortLabel(e.date))}
          xDetails={progress.evaluations.map((e) => `${shortLabel(e.date)} · ${e.title}`)}
          series={series}
          scale={scale}
          format={metric.format}
        />
        <p className="small muted">{metric.hint} Pasa el cursor sobre una fecha para ver el detalle.</p>
      </section>

      <section className="card stack">
        <h3 style={{ margin: 0 }}>Detalle por alumno · {metric.label.toLowerCase()}</h3>
        <p className="small muted">Toca un nombre para verlo en la gráfica.</p>
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
                  {s.series.map((p) => {
                    const value = metric.student(p);
                    return (
                      <td key={p.evaluationId}>
                        {value === null ? <span className="muted">—</span> : <strong>{metric.format(value)}</strong>}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <td>
                  <strong>Promedio</strong>
                </td>
                {progress.evaluations.map((e, i) => {
                  const value = averageValues[i];
                  return (
                    <td key={e.evaluationId}>
                      <strong>{value === null || value === undefined ? "—" : metric.format(value)}</strong>
                    </td>
                  );
                })}
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
      <div className="empty">
        <Icon name="users" size={32} />
        <p>Primero crea una clase y agrega a tus alumnos.</p>
        <Link className="btn btn-primary" to="/docente/clases">
          <Icon name="plus" /> Crear clase
        </Link>
      </div>
    );
  }
  const selected = classroomId || classes[0]!._id;

  return (
    <div className="stack">
      <div className="page-head">
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
