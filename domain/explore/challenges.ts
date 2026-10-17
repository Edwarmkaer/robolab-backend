/**
 * Retos del modo abierto ("Explorar retos"): cualquiera los juega sin cuenta.
 *
 * Cada reto es un mapa más una consigna. Hay cinco tipos, todos de
 * pensamiento computacional:
 *   sequence   armar la secuencia para llegar a la estrella
 *   predict    leer un programa y adivinar dónde termina el robot
 *   fix        corregir un programa que tiene un error
 *   stops      pasar por todas las paradas antes de la estrella
 *   efficient  llegar con pocos bloques (usando Repetir)
 */
import type { EducationLevel } from "../game/levels";
import { type GameMap, parseMap } from "../game/map";
import { type Program, move, repeat } from "../game/program";

export type Topic = "ciencia" | "tecnologia" | "ingenieria" | "artes" | "matematicas";

export type TopicInfo = {
  readonly id: Topic;
  readonly name: string;
  readonly tagline: string;
  readonly emoji: string;
  /** Los demás tópicos se muestran como "Próximamente". */
  readonly available: boolean;
};

export const TOPICS: readonly TopicInfo[] = [
  { id: "ciencia", name: "Ciencia", tagline: "Experimenta y descubre", emoji: "🔬", available: false },
  { id: "tecnologia", name: "Tecnología", tagline: "Programa y resuelve", emoji: "🤖", available: true },
  { id: "ingenieria", name: "Ingeniería", tagline: "Diseña y construye", emoji: "⚙️", available: false },
  { id: "artes", name: "Artes", tagline: "Crea patrones y formas", emoji: "🎨", available: false },
  { id: "matematicas", name: "Matemáticas", tagline: "Cuenta, mide y razona", emoji: "➗", available: false },
];

export const topicInfo = (id: string): TopicInfo | undefined => TOPICS.find((t) => t.id === id);

type Common = {
  readonly id: string;
  readonly topic: Topic;
  readonly level: EducationLevel;
  readonly difficulty: 1 | 2 | 3 | 4;
  readonly title: string;
  readonly emoji: string;
  /** Lo que se practica, para la ficha del reto. */
  readonly skill: string;
  readonly minutes: string;
  readonly story: string;
  readonly map: GameMap;
  /** De lo más general a lo más concreto: la tercera casi da la respuesta. */
  readonly hints: readonly [string, string, string];
};

export type Challenge =
  | (Common & { readonly kind: "sequence" })
  | (Common & { readonly kind: "predict"; readonly given: Program })
  | (Common & { readonly kind: "fix"; readonly given: Program })
  | (Common & { readonly kind: "stops" })
  | (Common & { readonly kind: "efficient"; readonly maxBlocks: number });

export const KIND_LABEL: Record<Challenge["kind"], string> = {
  sequence: "Secuencia",
  predict: "Predicción",
  fix: "Corregir",
  stops: "Paradas",
  efficient: "Eficiencia",
};

const F = move("FORWARD");
const B = move("BACKWARD");
const L = move("TURN_LEFT");
const R = move("TURN_RIGHT");

export const CHALLENGES: readonly Challenge[] = [
  // ---------- Inicial: avanzar y girar ----------
  {
    id: "inicial-paseo",
    kind: "sequence",
    topic: "tecnologia",
    level: "inicial",
    difficulty: 1,
    title: "Primer paseo",
    emoji: "🚶",
    skill: "Secuencias",
    minutes: "2-3 min",
    story: "Kusi quiere llegar a la estrella. ¡Está en línea recta!",
    map: parseMap("inicial-paseo", ["S..G"], 90),
    hints: ["Kusi ya mira hacia la estrella.", "Cuenta las casillas que hay hasta la estrella.", "Usa 3 bloques de Avanzar."],
  },
  {
    id: "inicial-gira",
    kind: "sequence",
    topic: "tecnologia",
    level: "inicial",
    difficulty: 1,
    title: "Gira a la estrella",
    emoji: "↪️",
    skill: "Secuencias y giros",
    minutes: "3-5 min",
    story: "El camino baja por la derecha. Ayuda a Kusi a girar en el momento justo.",
    map: parseMap("inicial-gira", ["S.#", "#.#", "#.G"], 90),
    hints: [
      "Primero avanza una casilla.",
      "Para bajar, Kusi gira a la derecha.",
      "Avanza, gira a la derecha, avanza 2, gira a la izquierda y avanza.",
    ],
  },
  {
    id: "inicial-charquito",
    kind: "sequence",
    topic: "tecnologia",
    level: "inicial",
    difficulty: 2,
    title: "El charquito",
    emoji: "💧",
    skill: "Esquivar obstáculos",
    minutes: "3-5 min",
    story: "Hay un charco entre Kusi y la estrella. ¡No quiere mojarse!",
    map: parseMap("inicial-charquito", ["...", "SWG"], 90),
    hints: [
      "No pises el charco: rodéalo por arriba.",
      "Gira a la izquierda para subir.",
      "Sube, avanza 2 a la derecha y baja a la estrella.",
    ],
  },
  {
    id: "inicial-donde",
    kind: "predict",
    topic: "tecnologia",
    level: "inicial",
    difficulty: 2,
    title: "¿Dónde llegará?",
    emoji: "🔮",
    skill: "Leer programas",
    minutes: "2-3 min",
    story: "Mira el programa de Kusi y toca la casilla donde va a terminar.",
    map: parseMap("inicial-donde", ["...", "...", "S.."], 0, { goalOptional: true }),
    given: [F, F, R, F],
    hints: [
      "Sigue los bloques uno por uno con tu dedo.",
      "Al empezar, Kusi mira hacia arriba.",
      "Sube 2 casillas y luego avanza 1 a la derecha.",
    ],
  },
  {
    id: "inicial-arregla",
    kind: "fix",
    topic: "tecnologia",
    level: "inicial",
    difficulty: 2,
    title: "Arregla el paseo",
    emoji: "🛠️",
    skill: "Encontrar errores",
    minutes: "2-3 min",
    story: "Este programa tiene un error y Kusi se sale del camino. ¡Arréglalo!",
    map: parseMap("inicial-arregla", ["S...G"], 90),
    given: [F, F, R, F, F],
    hints: [
      "Ejecuta el programa y mira dónde se sale Kusi.",
      "Hay un giro que no debería estar.",
      "Toca el bloque de girar para quitarlo.",
    ],
  },

  // ---------- Primaria: también retroceder y repetir ----------
  {
    id: "primaria-casa",
    kind: "sequence",
    topic: "tecnologia",
    level: "primaria",
    difficulty: 1,
    title: "A casa",
    emoji: "🧸",
    skill: "Secuencias y planificación",
    minutes: "3-5 min",
    story: "Kusi termina de jugar y vuelve a la estrella por el camino.",
    map: parseMap("primaria-casa", ["S..#", "##.#", "##.G"], 90),
    hints: [
      "El camino va a la derecha y luego baja.",
      "Avanza 2 y gira a la derecha.",
      "Avanza 2, gira a la derecha, avanza 2, gira a la izquierda y avanza 1.",
    ],
  },
  {
    id: "primaria-charco",
    kind: "sequence",
    topic: "tecnologia",
    level: "primaria",
    difficulty: 2,
    title: "El charco",
    emoji: "💧",
    skill: "Esquivar obstáculos",
    minutes: "5-8 min",
    story: "Kusi quiere llegar a la estrella sin pasar por el charco. Arma la secuencia de pasos para ayudarlo.",
    map: parseMap("primaria-charco", ["....", "S.WG"], 90),
    hints: [
      "Rodea el charco por arriba.",
      "Avanza 1 y gira a la izquierda para subir.",
      "Avanza, sube, avanza 2 a la derecha y baja a la estrella.",
    ],
  },
  {
    id: "primaria-donde",
    kind: "predict",
    topic: "tecnologia",
    level: "primaria",
    difficulty: 2,
    title: "¿Dónde llegará?",
    emoji: "🔮",
    skill: "Leer programas",
    minutes: "3-5 min",
    story: "Lee el programa de Kusi, con su Repetir, y toca la casilla donde termina.",
    map: parseMap("primaria-donde", ["....", "....", "....", "S..."], 0, { goalOptional: true }),
    given: [repeat(2, [F]), R, repeat(3, [F]), B],
    hints: [
      "Repetir 2 veces Avanzar es lo mismo que avanzar 2 casillas.",
      "Retroceder mueve a Kusi hacia atrás sin girar.",
      "Sube 2, avanza 3 a la derecha y retrocede 1.",
    ],
  },
  {
    id: "primaria-arregla",
    kind: "fix",
    topic: "tecnologia",
    level: "primaria",
    difficulty: 3,
    title: "Arregla el camino",
    emoji: "🛠️",
    skill: "Encontrar errores",
    minutes: "5-8 min",
    story: "Alguien escribió este programa, pero Kusi se sale del camino. Encuentra el error y corrígelo.",
    map: parseMap("primaria-arregla", ["S...#", "###.#", "###.G"], 90),
    given: [F, F, F, F, R, F, F, L, F],
    hints: [
      "Ejecuta el programa y mira en qué paso se sale.",
      "Kusi avanza una casilla de más antes de girar.",
      "Quita uno de los primeros bloques de Avanzar.",
    ],
  },
  {
    id: "primaria-paradas",
    kind: "stops",
    topic: "tecnologia",
    level: "primaria",
    difficulty: 3,
    title: "Dos paradas",
    emoji: "🚩",
    skill: "Metas intermedias",
    minutes: "5-8 min",
    story: "Kusi lleva pan a dos vecinos. Pasa por las dos banderas antes de llegar a la estrella.",
    map: parseMap("primaria-paradas", ["S.P..", "####.", "G..P."], 90),
    hints: [
      "Hay que pasar por las dos banderas antes de la estrella.",
      "El camino va a la derecha, baja y vuelve a la izquierda.",
      "Usa Repetir: avanza 4, gira a la derecha, avanza 2, gira a la derecha y avanza 4.",
    ],
  },
  {
    id: "primaria-menos",
    kind: "efficient",
    topic: "tecnologia",
    level: "primaria",
    difficulty: 4,
    title: "Menos pasos",
    emoji: "🧩",
    skill: "Patrones y eficiencia",
    minutes: "5-8 min",
    story: "El camino es una escalera. Llega a la estrella usando 6 bloques o menos.",
    map: parseMap("primaria-menos", ["S.##", "#..#", "##.G"], 90),
    maxBlocks: 6,
    hints: [
      "La escalera repite el mismo patrón.",
      "El patrón es: avanzar, girar a la derecha, avanzar, girar a la izquierda.",
      "Repite 2 veces ese patrón y termina con un Avanzar.",
    ],
  },
];

export const challengeById = (id: string): Challenge | undefined => CHALLENGES.find((c) => c.id === id);

export const challengesFor = (topic: string, level: EducationLevel): Challenge[] =>
  CHALLENGES.filter((c) => c.topic === topic && c.level === level);

/** El siguiente reto del mismo tópico y nivel, para "Siguiente reto". */
export function nextChallenge(current: Challenge): Challenge | undefined {
  const list = challengesFor(current.topic, current.level);
  return list[list.indexOf(current) + 1];
}
