import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import { localCalendarDate } from "../../domain/evaluation/calendar";
import { APP_NAME } from "../../shared/brand";
import { userMessage } from "../../shared/errors";
import { Icon } from "../../shared/ui/Icon";
import { speak } from "./speech";

type Props = { token: string; onSignOut: () => void };

export function StudentHome({ token, onSignOut }: Props) {
  const today = localCalendarDate();
  const home = useQuery(api.student.home, { token, today });
  const start = useMutation(api.student.start);
  const retry = useMutation(api.student.retry);
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

  async function playAgain() {
    if (!evaluation) return;
    setError(null);
    try {
      navigate(`/alumno/juego/${await retry({ token, evaluationId: evaluation.evaluationId })}`);
    } catch (e) {
      setError(userMessage(e));
    }
  }

  // Al salir vuelve a la portada, donde se elige "Soy alumno" o "Soy docente".
  async function leave() {
    await signOut({ token }).catch(() => undefined);
    onSignOut();
    navigate("/");
  }

  return (
    <main className="page kid stack" style={{ maxWidth: 720 }}>
      <div className="row spread">
        <span className="brand">
          <img src="/robot/robot.svg" alt="" />
          {APP_NAME}
        </span>
        <button className="btn btn-ghost" type="button" onClick={() => void leave()}>
          <Icon name="logOut" /> Salir
        </button>
      </div>
      {home === undefined ? (
        <p className="muted">Cargando…</p>
      ) : (
        <section className="card stack" style={{ textAlign: "center" }}>
          <h1>¡Hola, {home.displayName}!</h1>
          <p className="muted">{home.classroomLabel}</p>
          {!evaluation ? (
            <div className="empty">
              <Icon name="calendar" size={32} />
              <p>Hoy no tienes evaluaciones. ¡Vuelve pronto!</p>
            </div>
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
                {!evaluation.finished && <Icon name="play" />}
                {evaluation.finished ? "Ver mi resultado" : evaluation.attemptId ? "Seguir jugando" : "¡Empezar!"}
              </button>
              {evaluation.finished && (
                <button className="btn" type="button" onClick={() => void playAgain()}>
                  <Icon name="rotate" /> Intentar de nuevo
                </button>
              )}
            </>
          )}
        </section>
      )}
    </main>
  );
}
