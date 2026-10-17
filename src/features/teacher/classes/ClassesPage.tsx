import { useMutation, useQuery } from "convex/react";
import { type FormEvent, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { EDUCATION_LEVELS, type EducationLevel, LEVEL_LABEL } from "../../../domain/game/levels";
import { userMessage } from "../../../shared/errors";

function CreateClassForm() {
  const create = useMutation(api.classrooms.create);
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    try {
      const id = await create({
        level: form.get("level") as EducationLevel,
        grade: String(form.get("grade") ?? ""),
        section: String(form.get("section") ?? ""),
      });
      navigate(`/docente/clases/${id}`);
    } catch (e) {
      setError(userMessage(e));
    }
  }

  return (
    <form className="card stack" onSubmit={onSubmit}>
      <h3>Nueva clase</h3>
      <div className="row">
        <div className="field" style={{ flex: "1 1 160px" }}>
          <label htmlFor="level">Nivel</label>
          <select id="level" name="level" className="select" defaultValue="inicial">
            {EDUCATION_LEVELS.map((l) => (
              <option key={l} value={l}>
                {LEVEL_LABEL[l]}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ flex: "1 1 160px" }}>
          <label htmlFor="grade">Grado o edad</label>
          <input id="grade" name="grade" className="input" placeholder="5 años" required />
        </div>
        <div className="field" style={{ flex: "0 1 120px" }}>
          <label htmlFor="section">Sección</label>
          <input id="section" name="section" className="input" placeholder="A" required maxLength={10} />
        </div>
      </div>
      {error && <p className="alert alert-error">{error}</p>}
      <button className="btn btn-primary" type="submit">
        Crear clase
      </button>
    </form>
  );
}

function ClassDetail({ classroomId }: { classroomId: Id<"classrooms"> }) {
  const classroom = useQuery(api.classrooms.get, { classroomId });
  const addStudents = useMutation(api.classrooms.addStudents);
  const [names, setNames] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (classroom === undefined) return <p className="muted">Cargando…</p>;

  async function onAdd(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await addStudents({ classroomId, names: names.split("\n") });
      setNames("");
    } catch (e) {
      setError(userMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card stack">
      <div className="row spread">
        <h3>{classroom.label}</h3>
        <button className="btn" type="button" onClick={() => window.print()}>
          Imprimir códigos
        </button>
      </div>
      {classroom.students.length === 0 ? (
        <p className="empty">Agrega a tus alumnos para generar sus códigos de acceso.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Alumno</th>
                <th>Código de acceso</th>
              </tr>
            </thead>
            <tbody>
              {classroom.students.map((s) => (
                <tr key={s._id}>
                  <td>{s.displayName}</td>
                  <td className="code">{s.accessCode}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <form className="stack" onSubmit={onAdd}>
        <div className="field">
          <label htmlFor="names">Agregar alumnos (un nombre por línea)</label>
          <textarea
            id="names"
            className="input"
            rows={4}
            value={names}
            onChange={(e) => setNames(e.target.value)}
            placeholder={"Ana\nBeto\nCarla"}
          />
          <span className="small muted">Usa solo el nombre o un apodo: no hace falta el apellido.</span>
        </div>
        {error && <p className="alert alert-error">{error}</p>}
        <button className="btn btn-primary" type="submit" disabled={busy || names.trim() === ""}>
          {busy ? "Generando códigos…" : "Agregar y generar códigos"}
        </button>
      </form>
    </section>
  );
}

export function ClassesPage() {
  const { classroomId } = useParams();
  const classes = useQuery(api.classrooms.listMine);

  return (
    <div className="stack">
      <h2>Mis clases</h2>
      <div className="game" style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 420px)" }}>
        <div className="stack">
          {classroomId ? (
            <ClassDetail classroomId={classroomId as Id<"classrooms">} />
          ) : (
            <p className="empty">Elige una clase para ver a sus alumnos y sus códigos.</p>
          )}
        </div>
        <div className="stack">
          <CreateClassForm />
          {classes && classes.length > 0 && (
            <div className="card stack">
              <h3>Tus clases</h3>
              {classes.map((c) => (
                <Link
                  key={c._id}
                  className="btn"
                  style={{ justifyContent: "space-between" }}
                  to={`/docente/clases/${c._id}`}
                  aria-current={c._id === classroomId ? "page" : undefined}
                >
                  <span>{c.label}</span>
                  <span className="badge">{c.studentCount}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
