import { useMutation, useQuery } from "convex/react";
import { type FormEvent, useReducer, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { localCalendarDate } from "../../../domain/evaluation/calendar";
import { userMessage } from "../../../shared/errors";
import { MAX_OPTIONS, MAX_QUESTIONS, draftsReducer, emptyQuestion, toPayload } from "./questionDraft";

export function EvaluationForm() {
  const classes = useQuery(api.classrooms.listMine);
  const create = useMutation(api.evaluations.create);
  const navigate = useNavigate();
  const [drafts, dispatch] = useReducer(draftsReducer, undefined, () => [emptyQuestion()]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (classes === undefined) return <p className="muted">Cargando…</p>;
  if (classes.length === 0) {
    return (
      <p className="empty">
        Primero <Link to="/docente/clases">crea una clase</Link> con tus alumnos.
      </p>
    );
  }

  const maxScore = drafts.reduce((s, q) => s + (q.points || 0), 0);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const id = await create({
        classroomId: String(form.get("classroomId")) as Id<"classrooms">,
        title: String(form.get("title") ?? ""),
        scheduledDate: String(form.get("scheduledDate") ?? ""),
        questions: toPayload(drafts),
      });
      navigate(`/docente/evaluaciones/${id}`);
    } catch (e) {
      setError(userMessage(e));
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <h2>Nueva evaluación</h2>
      <section className="card stack">
        <div className="field">
          <label htmlFor="title">Título</label>
          <input id="title" name="title" className="input" required minLength={3} maxLength={80} placeholder="Los animales de la granja" />
        </div>
        <div className="row">
          <div className="field" style={{ flex: "2 1 260px" }}>
            <label htmlFor="classroomId">Clase (nivel, grado y sección)</label>
            <select id="classroomId" name="classroomId" className="select" required>
              {classes.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: "1 1 160px" }}>
            <label htmlFor="scheduledDate">Fecha</label>
            <input id="scheduledDate" name="scheduledDate" type="date" className="input" required defaultValue={localCalendarDate()} />
          </div>
        </div>
      </section>

      {drafts.map((q, qi) => (
        <section key={q.key} className="card stack" aria-label={`Pregunta ${qi + 1}`}>
          <div className="row spread">
            <h3>Pregunta {qi + 1}</h3>
            <button
              className="btn btn-ghost btn-danger"
              type="button"
              disabled={drafts.length === 1}
              onClick={() => dispatch({ type: "remove", key: q.key })}
            >
              Quitar
            </button>
          </div>
          <div className="field">
            <label htmlFor={`${q.key}-prompt`}>Enunciado (se lee en voz alta al alumno)</label>
            <input
              id={`${q.key}-prompt`}
              className="input"
              value={q.prompt}
              maxLength={200}
              required
              onChange={(e) => dispatch({ type: "prompt", key: q.key, value: e.target.value })}
              placeholder="¿Qué animal dice miau?"
            />
          </div>
          <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="small muted">Alternativas: marca la correcta. Puedes usar emojis 🐱.</legend>
            {q.options.map((option, oi) => (
              <div className="row" key={oi}>
                <input
                  type="radio"
                  name={`${q.key}-correct`}
                  aria-label={`Alternativa ${oi + 1} es la correcta`}
                  checked={q.correctOption === oi}
                  onChange={() => dispatch({ type: "correct", key: q.key, index: oi })}
                  style={{ width: 22, height: 22 }}
                />
                <input
                  className="input"
                  style={{ flex: 1 }}
                  value={option}
                  maxLength={80}
                  required
                  aria-label={`Alternativa ${oi + 1}`}
                  onChange={(e) => dispatch({ type: "option", key: q.key, index: oi, value: e.target.value })}
                />
                <button
                  className="btn btn-ghost"
                  type="button"
                  aria-label={`Quitar alternativa ${oi + 1}`}
                  disabled={q.options.length <= 2}
                  onClick={() => dispatch({ type: "removeOption", key: q.key, index: oi })}
                >
                  ✕
                </button>
              </div>
            ))}
          </fieldset>
          <div className="row spread">
            <button
              className="btn"
              type="button"
              disabled={q.options.length >= MAX_OPTIONS}
              onClick={() => dispatch({ type: "addOption", key: q.key })}
            >
              Agregar alternativa
            </button>
            <div className="row">
              <label htmlFor={`${q.key}-points`} className="small">
                Puntaje
              </label>
              <input
                id={`${q.key}-points`}
                type="number"
                className="input"
                style={{ width: 90 }}
                min={1}
                max={20}
                value={q.points}
                onChange={(e) => dispatch({ type: "points", key: q.key, value: e.target.valueAsNumber })}
              />
            </div>
          </div>
        </section>
      ))}

      <div className="row spread">
        <button
          className="btn"
          type="button"
          disabled={drafts.length >= MAX_QUESTIONS}
          onClick={() => dispatch({ type: "add" })}
        >
          Agregar pregunta
        </button>
        <span className="muted">
          {drafts.length} {drafts.length === 1 ? "pregunta" : "preguntas"} · {maxScore} puntos · cada pregunta aparece al
          llegar a una estrella
        </span>
      </div>
      {error && <p className="alert alert-error">{error}</p>}
      <button className="btn btn-primary" type="submit" disabled={busy}>
        {busy ? "Guardando…" : "Guardar evaluación"}
      </button>
    </form>
  );
}
