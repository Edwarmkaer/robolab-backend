/**
 * Competencias y capacidades del Currículo Nacional de la Educación Básica
 * (MINEDU, Perú) que un reto o una evaluación de RoboLab permite evidenciar.
 * Los textos son los oficiales; la numeración es la de la lista de 31
 * competencias del CNEB.
 */
import type { Challenge } from "../explore/challenges";

export type CompetencyId = 22 | 23 | 25 | 28 | 29;

export type Competency = {
  readonly id: CompetencyId;
  readonly area: string;
  readonly name: string;
  readonly capacities: readonly string[];
};

export const COMPETENCIES: Record<CompetencyId, Competency> = {
  22: {
    id: 22,
    area: "Ciencia y Tecnología",
    name: "Diseña y construye soluciones tecnológicas para resolver problemas de su entorno",
    capacities: [
      "Determina una alternativa de solución tecnológica",
      "Diseña la alternativa de solución tecnológica",
      "Implementa y valida la alternativa de solución tecnológica",
      "Evalúa y comunica el funcionamiento y los impactos de su alternativa de solución tecnológica",
    ],
  },
  23: {
    id: 23,
    area: "Matemática",
    name: "Resuelve problemas de cantidad",
    capacities: [
      "Traduce cantidades a expresiones numéricas",
      "Comunica su comprensión sobre los números y las operaciones",
      "Usa estrategias y procedimientos de estimación y cálculo",
      "Argumenta afirmaciones sobre las relaciones numéricas y las operaciones",
    ],
  },
  25: {
    id: 25,
    area: "Matemática",
    name: "Resuelve problemas de forma, movimiento y localización",
    capacities: [
      "Modela objetos con formas geométricas y sus transformaciones",
      "Comunica su comprensión sobre las formas y relaciones geométricas",
      "Usa estrategias y procedimientos para orientarse en el espacio",
      "Argumenta afirmaciones sobre relaciones geométricas",
    ],
  },
  28: {
    id: 28,
    area: "Transversal",
    name: "Se desenvuelve en los entornos virtuales generados por las TIC",
    capacities: [
      "Personaliza entornos virtuales",
      "Gestiona información del entorno virtual",
      "Interactúa en entornos virtuales",
      "Crea objetos virtuales en diversos formatos",
    ],
  },
  29: {
    id: 29,
    area: "Transversal",
    name: "Gestiona su aprendizaje de manera autónoma",
    capacities: [
      "Define metas de aprendizaje",
      "Organiza acciones estratégicas para alcanzar sus metas de aprendizaje",
      "Monitorea y ajusta su desempeño durante el proceso de aprendizaje",
    ],
  },
};

/** Una capacidad que el reto pone en juego, y qué hace el niño para evidenciarla. */
export type Evidence = {
  readonly competency: CompetencyId;
  /** Índice en `capacities`. */
  readonly capacity: number;
  readonly how: string;
};

const PROGRAM: Evidence = { competency: 28, capacity: 3, how: "Arma un programa con bloques y lo ejecuta en el robot" };
const ORIENT: Evidence = { competency: 25, capacity: 2, how: "Decide cuántas casillas avanzar y hacia dónde girar" };
const PREDICT: Evidence = { competency: 25, capacity: 1, how: "Lee un programa y explica dónde terminará el robot" };
const DEBUG: Evidence = { competency: 29, capacity: 2, how: "Encuentra el paso que falla y lo corrige" };
const PLAN: Evidence = { competency: 29, capacity: 1, how: "Planea el orden de las paradas antes de ejecutar" };
const COUNT: Evidence = { competency: 23, capacity: 2, how: "Cuenta pasos repetidos y los expresa con Repetir × n" };
const DESIGN: Evidence = { competency: 22, capacity: 1, how: "Busca la solución con menos bloques que cumpla el reto" };

/** Qué competencias evidencia un reto del modo abierto, según su tipo. */
export function evidenceFor(challenge: Pick<Challenge, "kind" | "level">): readonly Evidence[] {
  switch (challenge.kind) {
    case "sequence":
      return [PROGRAM, ORIENT];
    case "predict":
      return [PREDICT, PROGRAM];
    case "fix":
      return [PROGRAM, ORIENT, DEBUG];
    case "stops":
      return [PROGRAM, ORIENT, PLAN];
    case "efficient":
      return challenge.level === "inicial" ? [PROGRAM, COUNT] : [PROGRAM, COUNT, DESIGN];
  }
}

/** Lo que evidencia la parte de juego de una evaluación de clase (llevar al robot a cada estrella). */
export const EVALUATION_EVIDENCE: readonly Evidence[] = [PROGRAM, ORIENT];

export const capacityText = (e: Evidence): string => COMPETENCIES[e.competency].capacities[e.capacity]!;

export type Coverage = {
  readonly competency: Competency;
  /** Retos que la evidencian y cuántos de ellos están resueltos. */
  readonly total: number;
  readonly solved: number;
};

/** Cobertura por competencia: de los retos que la evidencian, cuántos resolvió. */
export function coverage(challenges: readonly Challenge[], solvedIds: ReadonlySet<string>): readonly Coverage[] {
  const ids = Object.keys(COMPETENCIES).map(Number) as CompetencyId[];
  return ids
    .map((id) => {
      const covering = challenges.filter((c) => evidenceFor(c).some((e) => e.competency === id));
      return { competency: COMPETENCIES[id], total: covering.length, solved: covering.filter((c) => solvedIds.has(c.id)).length };
    })
    .filter((c) => c.total > 0);
}
