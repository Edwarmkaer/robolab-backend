import { Link, Navigate, useParams } from "react-router-dom";
import { KIND_LABEL, challengesFor, topicInfo } from "../../domain/explore/challenges";
import { EDUCATION_LEVELS, type EducationLevel } from "../../domain/game/levels";
import { Icon } from "../../shared/ui/Icon";
import { Breadcrumbs, ExploreLayout, LEVEL_INFO } from "./ExploreLayout";
import { useExploreProgress } from "./storage";

const isLevel = (value: string): value is EducationLevel => (EDUCATION_LEVELS as readonly string[]).includes(value);

/** Los retos de un tópico y nivel. */
export function ChallengeListPage() {
  const { topic: topicId = "", level = "" } = useParams();
  const topic = topicInfo(topicId);
  const { progress } = useExploreProgress();
  if (!topic || !topic.available || !isLevel(level)) return <Navigate to="/" replace />;
  const challenges = challengesFor(topic.id, level);

  return (
    <ExploreLayout>
      <Breadcrumbs
        items={[{ label: "Explorar", to: "/" }, { label: topic.name, to: `/explorar/${topic.id}` }, { label: LEVEL_INFO[level].name }]}
      />
      <div className="page-head">
        <h1 style={{ margin: 0 }}>
          Retos de {topic.name} · {LEVEL_INFO[level].name}
        </h1>
        <div className="segmented" role="group" aria-label="Nivel">
          {EDUCATION_LEVELS.map((l) =>
            challengesFor(topic.id, l).length > 0 ? (
              <Link key={l} to={`/explorar/${topic.id}/${l}`} aria-current={l === level ? "page" : undefined} className="segmented-link">
                {LEVEL_INFO[l].name}
              </Link>
            ) : null,
          )}
        </div>
      </div>
      {challenges.length === 0 ? (
        <div className="empty">
          <Icon name="clipboard" size={32} />
          <p>Estos retos están en preparación. ¡Vuelve pronto!</p>
        </div>
      ) : (
        <div className="challenge-grid">
          {challenges.map((c) => {
            const done = progress.records[c.id]?.solved;
            return (
              <Link key={c.id} className="challenge-card" to={`/reto/${c.id}`} data-done={done || undefined}>
                <span className="challenge-art" aria-hidden="true">
                  {c.emoji}
                </span>
                <span className="challenge-info">
                  <strong>{c.title}</strong>
                  <span className="small muted">
                    Nivel {c.difficulty} · {KIND_LABEL[c.kind]}
                  </span>
                  {done && (
                    <span className="badge badge-ok">
                      <Icon name="check" size={14} /> Hecho
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </ExploreLayout>
  );
}
