/**
 * Catálogo de lo que un docente puede asignar a su clase y un alumno jugar en
 * /reto/:id: los retos de bloques (Inicial) y las misiones de Primaria
 * (`domain/lab`). Una sola ficha para ambos, con lo que las pantallas del
 * docente necesitan (T2, T4, T8b, T9).
 */
import { CHALLENGES, type Challenge, KIND_LABEL, type Topic, topicInfo } from "../explore/challenges";
import type { EducationLevel } from "../game/levels";
import { openChallenges } from "../explore/progress";
import type { Cell, Heading } from "../game/map";
import { MISSIONS, type Mission } from "../lab/mission";

export type CatalogKind = Challenge["kind"] | "mission";

export const CATALOG_KIND_LABEL: Record<CatalogKind, string> = { ...KIND_LABEL, mission: "Misión" };

/** El tablero de un reto de bloques, listo para dibujarlo (sin el Set de casillas). */
export type CatalogMap = {
  readonly rows: number;
  readonly cols: number;
  readonly layout: readonly string[];
  readonly start: Cell;
  readonly startHeading: Heading;
  readonly goal: Cell | null;
  readonly stops: readonly Cell[];
};

export type CatalogItem = {
  readonly challengeId: string;
  readonly title: string;
  readonly topic: Topic;
  readonly topicName: string;
  readonly level: EducationLevel;
  readonly kind: CatalogKind;
  readonly kindLabel: string;
  readonly difficulty: 1 | 2 | 3 | 4;
  readonly emoji: string;
  readonly skill: string;
  readonly minutes: string;
  readonly story: string;
  readonly hints: readonly string[];
  /** Null en las misiones: su tablero 6 × 6 (con paredes, terreno difícil y estaciones) está en `domain/lab` (`missionById`). */
  readonly map: CatalogMap | null;
};

/** Las misiones traen tres subniveles de dificultad; en la lista cuentan como un reto exigente. */
export const MISSION_DIFFICULTY = 3;

function fromChallenge(c: Challenge): CatalogItem {
  return {
    challengeId: c.id,
    title: c.title,
    topic: c.topic,
    topicName: topicInfo(c.topic)?.name ?? c.topic,
    level: c.level,
    kind: c.kind,
    kindLabel: KIND_LABEL[c.kind],
    difficulty: c.difficulty,
    emoji: c.emoji,
    skill: c.skill,
    minutes: c.minutes,
    story: c.story,
    hints: c.hints,
    map: {
      rows: c.map.rows,
      cols: c.map.cols,
      layout: c.map.layout,
      start: c.map.start,
      startHeading: c.map.startHeading,
      goal: c.map.goal,
      stops: c.map.stops,
    },
  };
}

function fromMission(m: Mission): CatalogItem {
  return {
    challengeId: m.id,
    title: m.title,
    topic: m.topic,
    topicName: topicInfo(m.topic)?.name ?? m.topic,
    level: m.level,
    kind: "mission",
    kindLabel: CATALOG_KIND_LABEL.mission,
    difficulty: MISSION_DIFFICULTY,
    emoji: m.emoji,
    skill: "Planificar una ruta con presupuesto de energía",
    minutes: "10-15 min",
    story: m.story,
    hints: m.hints,
    map: null,
  };
}

/**
 * Todo lo asignable, en el orden en que se presenta: primero los retos de bloques
 * de Inicial y después las misiones de Primaria. Los retos de bloques de Primaria
 * (legado) ya no se ofrecen: ese nivel juega misiones.
 */
export function catalog(): readonly CatalogItem[] {
  return [...openChallenges().map(fromChallenge), ...MISSIONS.map(fromMission)];
}

/**
 * La ficha de un reto por su id. Reconoce también los retos de bloques de Primaria
 * que ya no se ofrecen, porque una clase pudo asignarlos antes.
 */
export function catalogItem(challengeId: string): CatalogItem | undefined {
  const challenge = CHALLENGES.find((c) => c.id === challengeId);
  if (challenge) return fromChallenge(challenge);
  const mission = MISSIONS.find((m) => m.id === challengeId);
  return mission ? fromMission(mission) : undefined;
}
