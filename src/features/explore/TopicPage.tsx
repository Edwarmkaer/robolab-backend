import { Link, Navigate, useParams } from "react-router-dom";
import { challengesFor, topicInfo } from "../../domain/explore/challenges";
import { EDUCATION_LEVELS } from "../../domain/game/levels";
import { Breadcrumbs, ExploreLayout, LEVEL_INFO, TOPIC_COLOR } from "./ExploreLayout";

/** Un tópico: elige tu nivel. */
export function TopicPage() {
  const { topic: topicId = "" } = useParams();
  const topic = topicInfo(topicId);
  if (!topic || !topic.available) return <Navigate to="/" replace />;

  return (
    <ExploreLayout>
      <Breadcrumbs items={[{ label: "Explorar", to: "/" }, { label: topic.name }]} />
      <div className="topic-head" style={{ ["--topic" as string]: TOPIC_COLOR[topic.id] }}>
        <span className="topic-emoji" aria-hidden="true">
          {topic.emoji}
        </span>
        <div>
          <h1 style={{ margin: 0 }}>{topic.name}</h1>
          <p className="muted">{topic.tagline}. Elige tu nivel.</p>
        </div>
      </div>
      <div className="level-grid">
        {EDUCATION_LEVELS.map((level) => {
          const info = LEVEL_INFO[level];
          const count = challengesFor(topic.id, level).length;
          const body = (
            <>
              <span className="level-dots" aria-hidden="true">
                {[1, 2, 3].map((d) => (
                  <span key={d} data-on={d <= info.dots} />
                ))}
              </span>
              <strong className="level-name">{info.name}</strong>
              <span className="level-ages">{info.ages}</span>
              <span className="small muted">{info.description}</span>
              <span className={count > 0 ? "badge" : "badge badge-muted"}>
                {count > 0 ? `${count} retos` : "Próximamente"}
              </span>
            </>
          );
          return count > 0 ? (
            <Link key={level} className="level-card" to={`/explorar/${topic.id}/${level}`}>
              {body}
            </Link>
          ) : (
            <div key={level} className="level-card" aria-disabled="true">
              {body}
            </div>
          );
        })}
      </div>
      <p className="small muted">Puedes cambiar de nivel cuando quieras.</p>
    </ExploreLayout>
  );
}
