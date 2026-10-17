import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import { localCalendarDate } from "../../domain/evaluation/calendar";
import { userMessage } from "../../shared/errors";
import { speak } from "./speech";

type Props = { token: string; onSignOut: () => void };

export function StudentHome({ token, onSignOut }: Props) {
  const today = localCalendarDate();
  const home = useQuery(api.student.home, { token, today });
  const start = useMutation(api.student.start);
  const signOut = useMutation(api.student.signOut);
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const evaluation = home?.evaluation ?? null;
  const name = home?.displayName;
  useEffect(() => {
    if (name) speak(`¡Hola, ${name}!`);
  }, [name]);

  async function begin() {
    if (!evaluation) return;
    setError(null);
    try {
      const attemptId = evaluation.attemptId ?? (await start({ token, evaluationId: evaluation.evaluationId }));
      navigate(`/alumno/juego/${attemptId}`);
    } catch (e) {
      setError(userMessage(e));
    }
  }

  async function leave() {
    await signOut({ token }).catch(() => undefined);
    onSignOut();
  }

  return (
    <main className="page kid stack" style={{ maxWidth: 720 }}>
      <div className="row spread">
        <span className="brand">
          <img src="/robot/robot.svg" alt="" />
          Inrobit Aula
        </span>
        <button className="btn btn-ghost" type="button" onClick={() => void leave()}>
          Salir
        </button>
      </div>
      {home === undefined ? (
        <p className="muted">Cargando…</p>
      ) : (
        <section className="card stack" style={{ textAlign: "center" }}>
          <h1>¡Hola, {home.displayName}!</h1>
          <p className="muted">{home.classroomLabel}</p>
          {!evaluation ? (
            <p className="empty">Hoy no tienes evaluaciones. ¡Vuelve pronto!</p>
          ) : (
            <>
              <h2>{evaluation.title}</h2>
              <p>
                {evaluation.finished
                  ? "¡Ya terminaste! Mira cómo te fue."
                  : evaluation.questionCount === 1
                    ? "Lleva al robot a la estrella. Ahí hay una pregunta."
                    : `Lleva al robot a ${evaluation.questionCount} estrellas. En cada estrella hay una pregunta.`}
              </p>
              {error && <p className="alert alert-error">{error}</p>}
              <button className="btn btn-primary" type="button" onClick={() => void begin()}>
                {evaluation.finished ? "Ver mi resultado" : evaluation.attemptId ? "Seguir jugando" : "¡Empezar!"}
              </button>
            </>
          )}
        </section>
      )}
    </main>
  );
}
