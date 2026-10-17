import { useState } from "react";
import { H, M, PLOT_H, PLOT_W, W, directLabels, yOf } from "./chartLayout";

export type ChartSeries = {
  readonly id: string;
  readonly label: string;
  /** Texto junto al último punto cuando la etiqueta completa no cabe. */
  readonly shortLabel?: string;
  readonly color: string;
  readonly dashed?: boolean;
  /** Un valor por punto del eje X; null = no rindió esa evaluación. */
  readonly values: readonly (number | null)[];
};

type Props = {
  readonly xLabels: readonly string[];
  readonly xDetails: readonly string[];
  readonly series: readonly ChartSeries[];
  readonly title: string;
};

const Y_TICKS = [0, 25, 50, 75, 100];

/** Tramos continuos: una evaluación no rendida corta la línea en vez de inventar un valor. */
function segments(values: readonly (number | null)[], xOf: (i: number) => number): string[] {
  const paths: string[] = [];
  let current = "";
  values.forEach((v, i) => {
    if (v === null) {
      if (current) paths.push(current);
      current = "";
      return;
    }
    current += `${current ? "L" : "M"}${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`;
  });
  if (current) paths.push(current);
  return paths;
}

export function ProgressChart({ xLabels, xDetails, series, title }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const n = xLabels.length;
  const xOf = (i: number) => (n === 1 ? M.left + PLOT_W / 2 : M.left + (i / (n - 1)) * PLOT_W);
  const step = n > 1 ? PLOT_W / (n - 1) : PLOT_W;

  return (
    <figure className="stack" style={{ margin: 0 }}>
      <div className="row" role="list" aria-label="Leyenda">
        {series.map((s) => (
          <span key={s.id} className="row small" role="listitem" style={{ gap: 6 }}>
            <svg width="28" height="10" aria-hidden="true">
              <line x1="0" y1="5" x2="28" y2="5" stroke={s.color} strokeWidth="2" strokeDasharray={s.dashed ? "5 4" : undefined} />
            </svg>
            {s.label}
          </span>
        ))}
      </div>
      <div style={{ position: "relative" }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={title} onMouseLeave={() => setHover(null)}>
          {Y_TICKS.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={M.left + PLOT_W} y1={yOf(t)} y2={yOf(t)} stroke="var(--c-line)" strokeWidth="1" />
              <text x={M.left - 8} y={yOf(t)} textAnchor="end" dominantBaseline="middle" fontSize="11" fill="var(--c-muted)">
                {t}%
              </text>
            </g>
          ))}
          {xLabels.map((label, i) => (
            <text key={i} x={xOf(i)} y={H - M.bottom + 20} textAnchor="middle" fontSize="11" fill="var(--c-muted)">
              {label}
            </text>
          ))}
          {hover !== null && (
            <line x1={xOf(hover)} x2={xOf(hover)} y1={M.top} y2={M.top + PLOT_H} stroke="var(--c-muted)" strokeWidth="1" strokeDasharray="3 3" />
          )}
          {/* En orden inverso: la primera serie (el alumno) queda encima si coincide con el promedio. */}
          {[...series].reverse().map((s) => (
            <g key={s.id}>
              {segments(s.values, xOf).map((d, k) => (
                <path key={k} d={d} fill="none" stroke={s.color} strokeWidth="2" strokeDasharray={s.dashed ? "6 5" : undefined} strokeLinejoin="round" />
              ))}
              {s.values.map((v, i) =>
                v === null ? null : (
                  <circle key={i} cx={xOf(i)} cy={yOf(v)} r={hover === i ? 6 : 4.5} fill={s.color} stroke="var(--c-surface)" strokeWidth="2" />
                ),
              )}
            </g>
          ))}
          {directLabels(series, xOf).map((l) => (
            <text key={l.id} x={l.x} y={l.y} dominantBaseline="middle" fontSize="12" fontWeight="700" fill="var(--c-ink)">
              {l.text}
            </text>
          ))}
          {xLabels.map((_, i) => (
            <rect
              key={i}
              x={xOf(i) - step / 2}
              y={M.top}
              width={step}
              height={PLOT_H}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              tabIndex={0}
              aria-label={xDetails[i]}
            />
          ))}
        </svg>
        {hover !== null && (
          <div
            className="card small"
            role="status"
            style={{
              position: "absolute",
              top: 8,
              left: `min(calc(${((xOf(hover) / W) * 100).toFixed(1)}% + 12px), calc(100% - 220px))`,
              padding: 10,
              width: 200,
              pointerEvents: "none",
            }}
          >
            <strong>{xDetails[hover]}</strong>
            {series.map((s) => (
              <div key={s.id} className="row spread" style={{ gap: 6 }}>
                <span className="row" style={{ gap: 6 }}>
                  <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 999, background: s.color }} />
                  {s.label}
                </span>
                <strong>{s.values[hover] === null ? "—" : `${s.values[hover]}%`}</strong>
              </div>
            ))}
          </div>
        )}
      </div>
    </figure>
  );
}
