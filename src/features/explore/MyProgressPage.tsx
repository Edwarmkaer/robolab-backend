import { useState } from "react";
import { Link } from "react-router-dom";
import { TOPICS } from "../../domain/explore/challenges";
import { topicProgress } from "../../domain/explore/progress";
import { Guide } from "../../shared/ui/Guide";
import { ExploreLayout, TOPIC_COLOR } from "./ExploreLayout";
import { useExploreProgress } from "./storage";

/** Lo resuelto en este dispositivo, por tópico. */
export function MyProgressPage() {
  const { progress, clear } = useExploreProgress();
  const [confirming, setConfirming] = useState(false);
  const solvedTotal = Object.values(progress.records).filter((r) => r.solved).length;

  return (
    <ExploreLayout>
      <h1 style={{ margin: 0 }}>Mi avance</h1>
      <p className="small muted">Se guarda solo en este dispositivo. Si borras los datos del navegador, se pierde.</p>
      <Guide
        mood={solvedTotal > 0 ? "happy" : "idle"}
        message={
          solvedTotal === 0
            ? "Todavía no resolviste retos. ¡Empecemos con uno de Tecnología!"
            : `¡Llevas ${solvedTotal} ${solvedTotal === 1 ? "reto resuelto" : "retos resueltos"}! Sigue así.`
        }
      />
      <section className="card stack" aria-label="Avance por tópico">
        {TOPICS.map((t) => {
          const { solved, total } = topicProgress(progress, t.id);
          return (
            <div key={t.id} className="progress-row" style={{ ["--topic" as string]: TOPIC_COLOR[t.id] }}>
              <span className="progress-label">
                <span aria-hidden="true">{t.emoji}</span> {t.name}
              </span>
              <div className="meter topic-meter" role="img" aria-label={total ? `${solved} de ${total} retos` : "Próximamente"}>
                <span style={{ ["--value" as string]: total ? solved / total : 0 }} />
              </div>
              <span className="small muted progress-count">{total ? `${solved} de ${total}` : "Próximamente"}</span>
            </div>
          );
        })}
      </section>
      <div className="row">
        <Link className="btn btn-primary" to="/explorar/tecnologia">
          Seguir explorando
        </Link>
        {solvedTotal > 0 &&
          (confirming ? (
            <span className="row" role="group" aria-label="Confirmar">
              <span className="small">¿Borrar todo tu avance?</span>
              <button
                type="button"
                className="btn btn-sm btn-danger"
                onClick={() => {
                  clear();
                  setConfirming(false);
                }}
              >
                Sí, borrar
              </button>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirming(false)}>
                Cancelar
              </button>
            </span>
          ) : (
            <button type="button" className="link-btn" onClick={() => setConfirming(true)}>
              Borrar mi avance
            </button>
          ))}
      </div>
    </ExploreLayout>
  );
}
