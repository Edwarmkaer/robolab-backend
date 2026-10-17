import { useMutation, useQuery } from "convex/react";
import { type FormEvent, useEffect, useReducer, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { localCalendarDate } from "../../../domain/evaluation/calendar";
import { LIMITS, type QuestionIssue, questionIssues } from "../../../domain/evaluation/rules";
import { userMessage } from "../../../shared/errors";
import { Icon } from "../../../shared/ui/Icon";
import { IconButton } from "../../../shared/ui/IconButton";
import { useToast } from "../../../shared/ui/Toast";
import { MAX_OPTIONS, MAX_QUESTIONS, MIN_OPTIONS, type QuestionDraft, draftsReducer, emptyQuestion, toPayload } from "./questionDraft";

const LETTERS = ["A", "B", "C", "D"];

function FieldError({ issue, id }: { issue: QuestionIssue | undefined; id: string }) {
  if (!issue) return null;
  return (
    <span id={id} className="field-error">
      <Icon name="alert" size={16} /> {issue.message}
    </span>
  );
}

export function EvaluationForm() {
  const classes = useQuery(api.classrooms.listMine);
  const create = useMutation(api.evaluations.create);
  const navigate = useNavigate();
  const toast = useToast();
  const [drafts, dispatch] = useReducer(draftsReducer, undefined, () => [emptyQuestion()]);
  const [title, setTitle] = useState("");
  const [showIssues, setShowIssues] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failedSubmits, setFailedSubmits] = useState(0);

  // Tras un intento fallido, lleva al primer campo marcado para no tener que buscarlo.
  useEffect(() => {
    if (failedSubmits === 0) return;
    const first = document.querySelector<HTMLElement>('[aria-invalid="true"]');
    first?.focus({ preventScroll: true });
    first?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [failedSubmits]);

  if (classes === undefined) return <p className="muted">Cargando…</p>;
  if (classes.length === 0) {
    return (
      <div className="empty">
        <Icon name="users" size={32} />
        <p>Para crear una evaluación primero necesitas una clase con tus alumnos.</p>
        <Link className="btn btn-primary" to="/docente/clases">
          <Icon name="plus" /> Crear clase
        </Link>
      </div>
    );
  }

  const issues = showIssues ? questionIssues(toPayload(drafts)) : [];
  const titleTooShort = showIssues && title.trim().length < LIMITS.titleMin;
  const issueFor = (q: number, field: QuestionIssue["field"], option?: number) =>
    issues.find((i) => i.question === q && i.field === field && (option === undefined || i.option === option));
  const maxScore = drafts.reduce((s, q) => s + (Number.isFinite(q.points) ? q.points : 0), 0);

  function remove(question: QuestionDraft, index: number) {
    dispatch({ type: "remove", key: question.key });
    toast(`Eliminaste la pregunta ${index + 1}.`, {
      tone: "info",
      action: { label: "Deshacer", onClick: () => dispatch({ type: "restore", question, index }) },
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setShowIssues(true);
    setError(null);
    const found = questionIssues(toPayload(drafts));
    if (found.length > 0 || title.trim().length < LIMITS.titleMin) {
      setFailedSubmits((n) => n + 1);
      return;
    }
    setBusy(true);
    try {
      const id = await create({
        classroomId: String(form.get("classroomId")) as Id<"classrooms">,
        title,
        scheduledDate: String(form.get("scheduledDate") ?? ""),
        questions: toPayload(drafts),
      });
      toast("Evaluación guardada. Tus alumnos la verán el día programado.");
      navigate(`/docente/evaluaciones/${id}`);
    } catch (e) {
      setError(userMessage(e));
      setBusy(false);
    }
  }

  const problemCount = issues.length + (titleTooShort ? 1 : 0);

  return (
    <form className="stack" onSubmit={onSubmit} noValidate>
      <div className="page-head">
        <h2>Nueva evaluación</h2>
        <Link className="btn btn-ghost" to="/docente/evaluaciones">
          Cancelar
        </Link>
      </div>

      <section className="card stack">
        <div className="field">
          <label htmlFor="title">Título</label>
          <input
            id="title"
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={LIMITS.titleMax}
            placeholder="Ej.: Los animales de la granja"
            aria-invalid={titleTooShort}
            aria-describedby={titleTooShort ? "title-error" : undefined}
          />
          {titleTooShort && (
            <span id="title-error" className="field-error">
              <Icon name="alert" size={16} /> Escribe un título de al menos {LIMITS.titleMin} letras.
            </span>
          )}
        </div>
        <div className="row" style={{ alignItems: "start" }}>
          <div className="field" style={{ flex: "2 1 260px" }}>
            <label htmlFor="classroomId">Clase</label>
            <select id="classroomId" name="classroomId" className="select" required>
              {classes.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.label} ({c.studentCount} {c.studentCount === 1 ? "alumno" : "alumnos"})
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: "1 1 160px" }}>
            <label htmlFor="scheduledDate">Día</label>
            <input id="scheduledDate" name="scheduledDate" type="date" className="input" required defaultValue={localCalendarDate()} />
          </div>
        </div>
      </section>

      {drafts.map((q, qi) => {
        const promptIssue = issueFor(qi, "prompt");
        const optionsIssue = issueFor(qi, "options") ?? issueFor(qi, "correct");
        const pointsIssue = issueFor(qi, "points");
        return (
          <section key={q.key} className="card q-card" aria-labelledby={`${q.key}-title`}>
            <div className="q-head">
              <h3 id={`${q.key}-title`}>Pregunta {qi + 1}</h3>
              <div className="q-tools">
                <IconButton icon="arrowUp" label={`Subir pregunta ${qi + 1}`} disabled={qi === 0} onClick={() => dispatch({ type: "move", key: q.key, by: -1 })} />
                <IconButton
                  icon="arrowDown"
                  label={`Bajar pregunta ${qi + 1}`}
                  disabled={qi === drafts.length - 1}
                  onClick={() => dispatch({ type: "move", key: q.key, by: 1 })}
                />
                <IconButton
                  icon="trash"
                  label={`Eliminar pregunta ${qi + 1}`}
                  tone="danger"
                  disabled={drafts.length === 1}
                  onClick={() => remove(q, qi)}
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor={`${q.key}-prompt`}>Enunciado</label>
              <input
                id={`${q.key}-prompt`}
                className="input"
                value={q.prompt}
                maxLength={LIMITS.promptMax}
                onChange={(e) => dispatch({ type: "prompt", key: q.key, value: e.target.value })}
                placeholder="Ej.: ¿Qué animal dice miau?"
                aria-invalid={promptIssue !== undefined}
                aria-describedby={`${q.key}-prompt-hint${promptIssue ? ` ${q.key}-prompt-error` : ""}`}
              />
              <span id={`${q.key}-prompt-hint`} className="hint">
                Se lee en voz alta al alumno.
              </span>
              <FieldError issue={promptIssue} id={`${q.key}-prompt-error`} />
            </div>

            <fieldset className="stack-sm" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="label" style={{ marginBottom: 8 }}>
                Alternativas <span className="hint">· marca la correcta. Puedes usar emojis 🐱</span>
              </legend>
              {q.options.map((option, oi) => {
                const optionIssue = issueFor(qi, "option", oi);
                const correct = q.correctOption === oi;
                return (
                  <div className="option-row" key={oi}>
                    <button
                      type="button"
                      className="correct-toggle"
                      aria-pressed={correct}
                      aria-label={`Alternativa ${LETTERS[oi]}: ${correct ? "es la correcta" : "marcar como correcta"}`}
                      onClick={() => dispatch({ type: "correct", key: q.key, index: oi })}
                    >
                      <Icon name={correct ? "checkCircle" : "circle"} size={22} />
                      {LETTERS[oi]}
                    </button>
                    <input
                      className="input"
                      value={option}
                      maxLength={LIMITS.optionMax}
                      aria-label={`Alternativa ${LETTERS[oi]}`}
                      placeholder={oi === 0 ? "Ej.: 🐱 Gato" : oi === 1 ? "Ej.: 🐶 Perro" : ""}
                      aria-invalid={optionIssue !== undefined}
                      aria-describedby={optionIssue ? `${q.key}-option-${oi}-error` : undefined}
                      onChange={(e) => dispatch({ type: "option", key: q.key, index: oi, value: e.target.value })}
                    />
                    <IconButton
                      icon="x"
                      label={`Quitar alternativa ${LETTERS[oi]}`}
                      disabled={q.options.length <= MIN_OPTIONS}
                      onClick={() => dispatch({ type: "removeOption", key: q.key, index: oi })}
                    />
                    <FieldError issue={optionIssue} id={`${q.key}-option-${oi}-error`} />
                  </div>
                );
              })}
              <FieldError issue={optionsIssue} id={`${q.key}-options-error`} />
            </fieldset>

            <div className="row spread">
              <button
                className="btn btn-ghost"
                type="button"
                disabled={q.options.length >= MAX_OPTIONS}
                onClick={() => dispatch({ type: "addOption", key: q.key })}
              >
                <Icon name="plus" /> Agregar alternativa
              </button>
              <div className="row" style={{ gap: 8 }}>
                <label htmlFor={`${q.key}-points`} className="label">
                  Puntos
                </label>
                <input
                  id={`${q.key}-points`}
                  type="number"
                  inputMode="numeric"
                  className="input points-input"
                  min={LIMITS.pointsMin}
                  max={LIMITS.pointsMax}
                  value={Number.isFinite(q.points) ? q.points : ""}
                  aria-invalid={pointsIssue !== undefined}
                  onChange={(e) => dispatch({ type: "points", key: q.key, value: e.target.valueAsNumber })}
                />
              </div>
            </div>
            <FieldError issue={pointsIssue} id={`${q.key}-points-error`} />
          </section>
        );
      })}

      <button
        className="btn"
        type="button"
        style={{ justifySelf: "start" }}
        disabled={drafts.length >= MAX_QUESTIONS}
        onClick={() => dispatch({ type: "add" })}
      >
        <Icon name="plus" /> Agregar pregunta {drafts.length >= MAX_QUESTIONS && `(máximo ${MAX_QUESTIONS})`}
      </button>

      {error && (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      )}

      <div className="form-footer">
        <span className="small">
          <strong>
            {drafts.length} {drafts.length === 1 ? "pregunta" : "preguntas"} · {maxScore} {maxScore === 1 ? "punto" : "puntos"}
          </strong>
          <span className="muted hide-mobile"> · cada pregunta aparece cuando el robot llega a una estrella</span>
          {problemCount > 0 && (
            <span className="field-error" role="status">
              <Icon name="alert" size={16} /> Revisa {problemCount === 1 ? "el campo marcado" : `los ${problemCount} campos marcados`}.
            </span>
          )}
        </span>
        <button className="btn btn-primary" type="submit" disabled={busy} aria-busy={busy}>
          {busy ? "Guardando…" : "Guardar evaluación"}
        </button>
      </div>
    </form>
  );
}
