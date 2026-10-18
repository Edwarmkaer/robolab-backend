/**
 * Creador de misiones del docente: a partir de un contexto y una semilla arma
 * una misión con uno de los tableros conocidos (plantillas locales, como en el
 * prototipo). "Otra variante" cambia la semilla: alterna el tablero y el orden
 * de las estaciones. Cuando haya un modelo de lenguaje que produzca el JSON,
 * entra por `validate()` igual que estas plantillas.
 */
import type { Topic } from "../explore/challenges";
import { BOARDS, BOARD_SIZE, type Mission, levelsFor } from "./mission";

export type Theme = "escuela" | "comunidad" | "biblioteca";
export const THEMES: readonly Theme[] = ["escuela", "comunidad", "biblioteca"];

export const THEME_INFO: Record<
  Theme,
  { readonly label: string; readonly title: string; readonly topic: Topic; readonly emoji: string; readonly story: string }
> = {
  escuela: {
    label: "Reparto de materiales en la escuela",
    title: "Ruta de materiales",
    topic: "tecnologia",
    emoji: "📦",
    story: "Reparte los materiales: pasa por las estaciones y termina en la meta sin gastar toda la energía.",
  },
  comunidad: {
    label: "Recorrido por la comunidad",
    title: "Recorrido comunitario",
    topic: "ciencia",
    emoji: "🏘️",
    story: "Recorre la comunidad: visita las estaciones y llega a la meta cuidando la energía.",
  },
  biblioteca: {
    label: "Organización de una biblioteca",
    title: "Ruta de la biblioteca",
    topic: "matematicas",
    emoji: "📚",
    story: "Ordena la biblioteca: deja los libros en las estaciones y termina en la meta.",
  },
};

export const isTheme = (value: unknown): value is Theme => typeof value === "string" && (THEMES as readonly string[]).includes(value);

const GENERIC_HINTS: Mission["hints"] = [
  "Cada paso gasta 1 de energía y el terreno amarillo gasta 3.",
  "Mira dónde están las estaciones y planifica en qué orden las visitas.",
  "Rodea las paredes y evita el terreno amarillo cuando puedas; después ve a la meta.",
];

/** La semilla elige el tablero (alternando por contexto) y el orden de las estaciones. */
export function generateMission(theme: Theme, seed: number): Mission {
  const s = Number.isInteger(seed) && seed >= 0 ? seed : 0;
  const info = THEME_INFO[theme];
  const board = BOARDS[(THEMES.indexOf(theme) + Math.floor(s / 2)) % BOARDS.length]!;
  const swap = s % 2 === 1;
  const [a, b] = board.stations;
  return {
    id: `docente-${theme}-${s}`,
    title: info.title,
    topic: info.topic,
    level: "primaria",
    story: info.story,
    emoji: info.emoji,
    size: BOARD_SIZE,
    walls: board.walls,
    rough: board.rough,
    stations: swap ? [b, a] : [a, b],
    start: [0, 0],
    goal: [5, 5],
    levels: levelsFor(board.budgets),
    hints: GENERIC_HINTS,
  };
}
