/** Geometría de la gráfica de progreso, sin React, para poder probarla. */

export const W = 640;
export const H = 280;
export const M = { top: 20, right: 96, bottom: 40, left: 44 };
export const PLOT_W = W - M.left - M.right;
export const PLOT_H = H - M.top - M.bottom;

/** Distancia vertical mínima entre dos etiquetas directas (alto de una línea de 12 px). */
export const LABEL_GAP = 15;
const MAX_LABEL_CHARS = 12;

export type Scale = {
  readonly top: number;
  readonly ticks: readonly number[];
  readonly yOf: (value: number) => number;
};

const TICK_COUNT = 4;

/** Paso "redondo" (1, 2, 2.5 o 5 por una potencia de 10) que no sea menor que `raw`. */
function niceStep(raw: number): number {
  const power = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((m) => m * power).find((step) => step >= raw - 1e-12) ?? 10 * power;
}

/**
 * Escala del eje vertical. Con `fixedTop` (el logro, siempre hasta 100) no
 * depende de los datos; si no, cubre el valor más alto con pasos redondos.
 */
export function scaleFor(maxValue: number, fixedTop?: number): Scale {
  const max = maxValue > 0 ? maxValue : 1;
  const step = fixedTop !== undefined ? fixedTop / TICK_COUNT : niceStep(max / TICK_COUNT);
  const top = fixedTop ?? Math.ceil(max / step - 1e-9) * step;
  const count = Math.round(top / step);
  const ticks = Array.from({ length: count + 1 }, (_, k) => Number((k * step).toFixed(6)));
  return { top, ticks, yOf: (value) => M.top + PLOT_H - (value / top) * PLOT_H };
}

export const PERCENT_SCALE = scaleFor(100, 100);
export const yOf = PERCENT_SCALE.yOf;

type LabeledSeries = {
  readonly id: string;
  readonly label: string;
  readonly shortLabel?: string;
  readonly values: readonly (number | null)[];
};

export type DirectLabel = { readonly id: string; readonly text: string; readonly x: number; readonly y: number };

const fit = (text: string) => (text.length > MAX_LABEL_CHARS ? `${text.slice(0, MAX_LABEL_CHARS - 1)}…` : text);

/**
 * Etiqueta de cada serie junto a su último punto. Si dos caen a la misma
 * altura (el alumno saca lo mismo que el promedio), se separan.
 */
export function directLabels(
  series: readonly LabeledSeries[],
  xOf: (i: number) => number,
  y: (value: number) => number = yOf,
): DirectLabel[] {
  const labels = series.flatMap((s) => {
    const last = s.values.findLastIndex((v) => v !== null);
    const value = s.values[last];
    if (last < 0 || value === null || value === undefined) return [];
    return [{ id: s.id, text: fit(s.shortLabel ?? s.label), x: xOf(last) + 10, y: y(value) }];
  });

  const placed: DirectLabel[] = [];
  for (const label of [...labels].sort((a, b) => a.y - b.y)) {
    const above = placed.findLast((p) => Math.abs(p.x - label.x) < 1);
    placed.push(above && label.y - above.y < LABEL_GAP ? { ...label, y: above.y + LABEL_GAP } : label);
  }
  return placed;
}
