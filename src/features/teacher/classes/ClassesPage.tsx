import { useMutation, useQuery } from "convex/react";
import { type FormEvent, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { parseStudentList } from "../../../domain/classroom/studentName";
import { LIMITS } from "../../../domain/evaluation/rules";
import { EDUCATION_LEVELS, type EducationLevel, LEVEL_LABEL } from "../../../domain/game/levels";
import { userMessage } from "../../../shared/errors";
import { Icon } from "../../../shared/ui/Icon";
import { IconButton } from "../../../shared/ui/IconButton";
import { useToast } from "../../../shared/ui/Toast";

const GRADE_SUGGESTIONS: Record<EducationLevel, readonly string[]> = {
  inicial: ["3 años", "4 años", "5 años"],
  primaria: ["1.er grado", "2.º grado", "3.er grado", "4.º grado", "5.º grado", "6.º grado"],
  secundaria: ["1.er año", "2.º año", "3.er año", "4.º año", "5.º año"],
};

function CreateClassForm({ onCancel }: { onCancel?: () => void }) {
  const create = useMutation(api.classrooms.create);
  const navigate = useNavigate();
  const toast = useToast();
  const [level, setLevel] = useState<EducationLevel>("inicial");
  const [grade, setGrade] = useState("");
  const [section, setSection] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const id = await create({ level, grade, section });
      toast("Clase creada. Ahora agrega a tus alumnos.");
      onCancel?.();
      navigate(`/docente/clases/${id}`);
    } catch (e) {
      setError(userMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card stack" onSubmit={onSubmit}>
      <div className="row spread">
        <h3 style={{ margin: 0 }}>Nueva clase</h3>
        {onCancel && <IconButton icon="x" label="Cerrar" onClick={onCancel} />}
      </div>
      <div className="field">
        <label htmlFor="level">Nivel</label>
        <select id="level" className="select" value={level} onChange={(e) => setLevel(e.target.value as EducationLevel)}>
          {EDUCATION_LEVELS.map((l) => (
            <option key={l} value={l}>
              {LEVEL_LABEL[l]}
            </option>
          ))}
        </select>
      </div>
      <div className="row" style={{ alignItems: "start" }}>
        <div className="field" style={{ flex: "2 1 150px" }}>
          <label htmlFor="grade">Grado o edad</label>
          <input
            id="grade"
            className="input"
            list="grade-suggestions"
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            placeholder={GRADE_SUGGESTIONS[level][GRADE_SUGGESTIONS[level].length - 1]}
            maxLength={LIMITS.gradeMax}
            required
          />
          <datalist id="grade-suggestions">
            {GRADE_SUGGESTIONS[level].map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </div>
        <div className="field" style={{ flex: "1 1 90px" }}>
          <label htmlFor="section">Sección</label>
          <input
            id="section"
            className="input"
            value={section}
            onChange={(e) => setSection(e.target.value.toUpperCase())}
            placeholder="A"
            maxLength={LIMITS.sectionMax}
            required
          />
        </div>
      </div>
      {error && (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      )}
      <button className="btn btn-primary" type="submit" disabled={busy || !grade.trim() || !section.trim()} aria-busy={busy}>
        {busy ? "Creando…" : "Crear clase"}
      </button>
    </form>
  );
}

function AddStudentsForm({ classroomId, existing }: { classroomId: Id<"classrooms">; existing: readonly string[] }) {
  const addStudents = useMutation(api.classrooms.addStudents);
  const toast = useToast();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const parsed = parseStudentList(text, existing);
  const count = parsed.names.length;
  const tooMany = count > LIMITS.studentsPerBatch;
  const ready = count > 0 && parsed.problemCount === 0 && !tooMany;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const created = await addStudents({ classroomId, names: [...parsed.names] });
      setText("");
      toast(
        created.length === 1
          ? `Agregaste a ${created[0]!.displayName}. Ya tiene su código.`
          : `Agregaste ${created.length} alumnos. Ya tienen sus códigos.`,
      );
    } catch (e) {
      setError(userMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <div className="field">
        <label htmlFor="names">Agregar alumnos</label>
        <textarea
          id="names"
          className="input"
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"Ana\nBenjamín\nCamila"}
          aria-describedby="names-hint"
          spellCheck={false}
        />
        <span id="names-hint" className="hint">
          Un nombre por línea (o separados por comas). Solo letras: se aceptan tildes, ñ, guion y apóstrofo. Puedes
          pegar la lista desde Excel.
        </span>
      </div>

      {parsed.entries.length > 0 && (
        <ul className="name-preview" aria-label="Así se agregarán">
          {parsed.entries.map((entry, i) => (
            <li key={i} data-status={entry.status}>
              <Icon name={entry.status === "ok" ? "checkCircle" : "alert"} size={18} />
              <span>{entry.status === "ok" ? entry.name : entry.input}</span>
              {entry.status !== "ok" && <span className="reason">{entry.reason}</span>}
            </li>
          ))}
        </ul>
      )}
      {parsed.problemCount > 0 && (
        <div className="row spread">
          <p className="hint" role="status">
            Corrige o borra {parsed.problemCount === 1 ? "la línea marcada" : `las ${parsed.problemCount} líneas marcadas`}{" "}
            para continuar.
          </p>
          <button type="button" className="link-btn small" onClick={() => setText(parsed.names.join("\n"))}>
            <Icon name="trash" size={16} /> Quitar las líneas marcadas
          </button>
        </div>
      )}
      {tooMany && (
        <p className="hint" role="status">
          Agrega hasta {LIMITS.studentsPerBatch} alumnos a la vez.
        </p>
      )}
      {error && (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      )}
      <button className="btn btn-primary" type="submit" disabled={busy || !ready} aria-busy={busy}>
        {busy ? "Generando códigos…" : count > 0 ? `Agregar ${count} ${count === 1 ? "alumno" : "alumnos"}` : "Agregar alumnos"}
      </button>
    </form>
  );
}

function ClassDetail({ classroomId }: { classroomId: Id<"classrooms"> }) {
  const classroom = useQuery(api.classrooms.get, { classroomId });
  const toast = useToast();

  if (classroom === undefined) return <p className="muted">Cargando…</p>;

  async function copy(name: string, code: string) {
    try {
      await navigator.clipboard.writeText(code);
      toast(`Copiaste el código de ${name}.`);
    } catch {
      toast("No se pudo copiar. Selecciona el código y cópialo a mano.", { tone: "error" });
    }
  }

  const studentUrl = `${window.location.origin}/alumno`;

  return (
    <section className="card stack">
      <div className="page-head">
        <div>
          <h3 style={{ margin: 0 }}>{classroom.label}</h3>
          <p className="muted small">
            {classroom.students.length} {classroom.students.length === 1 ? "alumno" : "alumnos"} · entran en{" "}
            <strong>{studentUrl.replace(/^https?:\/\//, "")}</strong>
          </p>
        </div>
        <button className="btn" type="button" disabled={classroom.students.length === 0} onClick={() => window.print()}>
          <Icon name="printer" /> Imprimir tarjetas
        </button>
      </div>

      {classroom.students.length === 0 ? (
        <div className="empty">
          <Icon name="users" size={32} />
          <p>Agrega a tus alumnos: cada uno recibe un código para entrar sin contraseña.</p>
        </div>
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
                  <td>
                    <span className="code-cell">
                      <span className="code">{s.accessCode}</span>
                      <IconButton icon="copy" label={`Copiar código de ${s.displayName}`} onClick={() => void copy(s.displayName, s.accessCode)} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddStudentsForm classroomId={classroomId} existing={classroom.students.map((s) => s.displayName)} />

      <div className="print-only" aria-hidden="true">
        <h2>{classroom.label}</h2>
        <p>Entra en {studentUrl} y escribe tu código.</p>
        <div className="print-cards">
          {classroom.students.map((s) => (
            <div key={s._id} className="print-card">
              <strong>{s.displayName}</strong>
              <div className="code">{s.accessCode}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ClassesPage() {
  const { classroomId } = useParams();
  const classes = useQuery(api.classrooms.listMine);
  const [creating, setCreating] = useState(false);
  const noClasses = classes !== undefined && classes.length === 0;

  return (
    <div className="stack">
      <div className="page-head">
        <h2>Mis clases</h2>
        {!creating && !noClasses && (
          <button className="btn btn-primary" type="button" onClick={() => setCreating(true)}>
            <Icon name="plus" /> Nueva clase
          </button>
        )}
      </div>
      <div className="two-col">
        <div className="stack">
          {classroomId ? (
            <ClassDetail key={classroomId} classroomId={classroomId as Id<"classrooms">} />
          ) : noClasses ? (
            <div className="empty">
              <Icon name="users" size={32} />
              <p>Crea tu primera clase con su nivel, grado y sección. Después agregas a tus alumnos.</p>
            </div>
          ) : (
            <div className="empty">
              <Icon name="users" size={32} />
              <p>Elige una clase para ver a sus alumnos y sus códigos.</p>
            </div>
          )}
        </div>
        <div className="stack">
          {(creating || noClasses) && <CreateClassForm {...(noClasses ? {} : { onCancel: () => setCreating(false) })} />}
          {classes && classes.length > 0 && (
            <nav className="card stack" aria-label="Tus clases">
              <h3 style={{ margin: 0 }}>Tus clases</h3>
              <div className="class-list">
                {classes.map((c) => (
                  <Link
                    key={c._id}
                    className="class-item"
                    to={`/docente/clases/${c._id}`}
                    aria-current={c._id === classroomId ? "page" : undefined}
                  >
                    <span>{c.label}</span>
                    <span className="badge badge-muted">
                      <Icon name="users" size={14} /> {c.studentCount}
                    </span>
                  </Link>
                ))}
              </div>
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
