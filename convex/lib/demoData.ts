/**
 * Datos de ejemplo para mostrar la app con historia: una clase de Inicial
 * con evaluaciones de semanas anteriores ya rendidas y una para hoy.
 *
 * Todo es ficticio y sale de una semilla fija, así que cada carga produce
 * las mismas notas. Las notas no se escriben a mano: se simulan respuestas
 * y se califican con las mismas reglas que una evaluación real.
 */
import type { EducationLevel } from "../../domain/game/levels";
import type { QuestionInput } from "./rules";

export const DEMO_CLASS: { level: EducationLevel; grade: string; section: string } = {
  level: "inicial",
  grade: "5 años",
  section: "B",
};

export const DEMO_SEED = 20261017;

/** Probabilidad de faltar a una evaluación: deja huecos reales en la gráfica. */
export const ABSENCE_RATE = 0.08;

/** Quien saca menos de esto a veces vuelve a intentarlo, como haría en clase. */
export const RETRY_BELOW_PERCENT = 75;
export const RETRY_RATE = 0.5;
export const MAX_DEMO_TRIES = 3;
/** Cuánto ayuda haber jugado antes, en "evaluaciones de práctica" equivalentes. */
export const RETRY_BOOST = 0.8;

export type StudentProfile = {
  readonly name: string;
  /** Probabilidad de acertar en la primera evaluación. */
  readonly ability: number;
  /** Cuánto mejora esa probabilidad en cada evaluación. */
  readonly growth: number;
};

// Perfiles variados para que la comparación alumno-promedio diga algo:
// quien avanza rápido, quien va estable y quien necesita apoyo.
export const DEMO_STUDENTS: readonly StudentProfile[] = [
  { name: "Ana", ability: 0.55, growth: 0.1 },
  { name: "Benjamín", ability: 0.45, growth: 0.12 },
  { name: "Camila", ability: 0.72, growth: 0.06 },
  { name: "Diego", ability: 0.4, growth: 0.02 },
  { name: "Valeria", ability: 0.6, growth: 0.09 },
  { name: "Mateo", ability: 0.5, growth: 0.1 },
  { name: "Luciana", ability: 0.66, growth: 0.07 },
  { name: "Thiago", ability: 0.32, growth: 0.15 },
  { name: "Ximena", ability: 0.58, growth: 0.08 },
  { name: "Santiago", ability: 0.48, growth: 0.11 },
  { name: "Mía", ability: 0.62, growth: 0.07 },
  { name: "Gael", ability: 0.42, growth: 0.09 },
];

export type DemoEvaluation = {
  readonly title: string;
  /** Días antes de hoy; 0 es la evaluación que se juega en vivo. */
  readonly daysAgo: number;
  readonly questions: readonly QuestionInput[];
};

export const DEMO_EVALUATIONS: readonly DemoEvaluation[] = [
  {
    title: "Los colores",
    daysAgo: 28,
    questions: [
      { prompt: "¿De qué color es el cielo de día?", options: ["🔵 Azul", "🔴 Rojo", "🟢 Verde"], correctOption: 0, points: 1 },
      { prompt: "¿De qué color es una fresa?", options: ["🟡 Amarillo", "🔴 Rojo", "🟣 Morado"], correctOption: 1, points: 1 },
      { prompt: "Si mezclas azul y amarillo, ¿qué color sale?", options: ["🟠 Naranja", "⚫ Negro", "🟢 Verde"], correctOption: 2, points: 2 },
    ],
  },
  {
    title: "Contamos hasta 10",
    daysAgo: 21,
    questions: [
      { prompt: "¿Cuántas manzanas hay? 🍎🍎🍎", options: ["2", "3", "4"], correctOption: 1, points: 1 },
      { prompt: "¿Qué número va después del 5?", options: ["4", "7", "6"], correctOption: 2, points: 1 },
      { prompt: "¿Cuántos dedos tiene una mano? ✋", options: ["5", "10", "3"], correctOption: 0, points: 1 },
      { prompt: "¿Dónde hay más peces?", options: ["🐟🐟", "🐟🐟🐟🐟"], correctOption: 1, points: 2 },
    ],
  },
  {
    title: "Las figuras",
    daysAgo: 14,
    questions: [
      { prompt: "¿Qué figura tiene una pelota? ⚽", options: ["🔺 Triángulo", "⚪ Círculo", "🟥 Cuadrado"], correctOption: 1, points: 1 },
      { prompt: "¿Cuántos lados tiene un triángulo? 🔺", options: ["3", "4", "5"], correctOption: 0, points: 1 },
      { prompt: "¿Qué figura tiene 4 lados iguales?", options: ["⚪ Círculo", "🔺 Triángulo", "🟥 Cuadrado"], correctOption: 2, points: 2 },
    ],
  },
  {
    title: "Los animales y sus casas",
    daysAgo: 7,
    questions: [
      { prompt: "¿Dónde vive el pez? 🐟", options: ["🌳 En el árbol", "🌊 En el agua", "🏠 En la casa"], correctOption: 1, points: 1 },
      { prompt: "¿Qué animal vive en la granja?", options: ["🐄 Vaca", "🦈 Tiburón", "🐧 Pingüino"], correctOption: 0, points: 1 },
      { prompt: "¿Qué come el conejo? 🐰", options: ["🍖 Carne", "🍕 Pizza", "🥕 Zanahoria"], correctOption: 2, points: 1 },
      { prompt: "¿Qué animal hace su casa en un árbol?", options: ["🐦 Pájaro", "🐮 Vaca", "🐷 Chancho"], correctOption: 0, points: 2 },
    ],
  },
  {
    title: "Mi cuerpo",
    daysAgo: 0,
    questions: [
      { prompt: "¿Con qué vemos?", options: ["👀 Los ojos", "👂 Las orejas", "👃 La nariz"], correctOption: 0, points: 1 },
      { prompt: "¿Con qué escuchamos?", options: ["👃 La nariz", "👂 Las orejas", "👄 La boca"], correctOption: 1, points: 1 },
      { prompt: "¿Cuántos ojos tienes?", options: ["1", "3", "2"], correctOption: 2, points: 2 },
    ],
  },
];

/** Generador pseudoaleatorio con semilla (mulberry32): mismas notas en cada carga. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type SimulatedAnswer = {
  readonly chosenOption: number;
  readonly shownAt: number;
  readonly answeredAt: number;
  readonly runs: number;
  readonly blocksUsed: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Lo que haría un alumno con ese perfil en la evaluación número `session`:
 * juega hasta la estrella, piensa y responde, pregunta por pregunta.
 */
export function simulateAttempt(
  random: () => number,
  profile: StudentProfile,
  session: number,
  questions: readonly QuestionInput[],
  startedAt: number,
): { answers: SimulatedAnswer[]; finishedAt: number } {
  const skill = clamp(profile.ability + profile.growth * session, 0.1, 0.97);
  let now = startedAt;
  const answers = questions.map((q) => {
    now += Math.round(20_000 + random() * 70_000 * (1.2 - skill)); // armar el programa y llegar a la estrella
    const shownAt = now;
    now += Math.round(3_000 + random() * 18_000 * (1.2 - skill)); // leer (o escuchar) y elegir
    const correct = random() < skill;
    const wrong = q.options.map((_, i) => i).filter((i) => i !== q.correctOption);
    const chosenOption = correct ? q.correctOption : (wrong[Math.floor(random() * wrong.length)] ?? q.correctOption);
    return {
      chosenOption,
      shownAt,
      answeredAt: now,
      // Quien entiende mejor necesita menos ejecuciones para llegar a la estrella.
      runs: 1 + Math.floor(random() * (1 + 4 * (1 - skill))),
      blocksUsed: 3 + Math.floor(random() * 4),
    };
  });
  return { answers, finishedAt: now + 1_000 };
}
