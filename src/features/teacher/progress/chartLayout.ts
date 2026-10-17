/** Geometría de la gráfica de progreso, sin React, para poder probarla. */

export const W = 640;
export const H = 280;
export const M = { top: 20, right: 96, bottom: 40, left: 44 };
export const PLOT_W = W - M.left - M.right;
export const PLOT_H = H - M.top - M.bottom;

/** Distancia vertical mínima entre dos etiquetas directas (alto de una línea de 12 px). */
export const LABEL_GAP = 15;
const MAX_LABEL_CHARS = 12;

export const yOf = (percent: number) => M.top + PLOT_H - (percent / 100) * PLOT_H;

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
export function directLabels(series: readonly LabeledSeries[], xOf: (i: number) => number): DirectLabel[] {
  const labels = series.flatMap((s) => {
    const last = s.values.findLastIndex((v) => v !== null);
    const value = s.values[last];
    if (last < 0 || value === null || value === undefined) return [];
    return [{ id: s.id, text: fit(s.shortLabel ?? s.label), x: xOf(last) + 10, y: yOf(value) }];
  });

  const placed: DirectLabel[] = [];
  for (const label of [...labels].sort((a, b) => a.y - b.y)) {
    const above = placed.findLast((p) => Math.abs(p.x - label.x) < 1);
    placed.push(above && label.y - above.y < LABEL_GAP ? { ...label, y: above.y + LABEL_GAP } : label);
  }
  return placed;
}
