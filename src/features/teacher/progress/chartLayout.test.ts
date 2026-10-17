import { describe, expect, it } from "vitest";
import { LABEL_GAP, M, PLOT_H, directLabels, scaleFor, yOf } from "./chartLayout";

const xOf = (i: number) => 100 + i * 50;

describe("directLabels", () => {
  it("usa la etiqueta corta cuando existe, para que no se corte", () => {
    const [label] = directLabels([{ id: "avg", label: "Promedio de la clase", shortLabel: "Promedio", values: [25] }], xOf);
    expect(label).toMatchObject({ text: "Promedio", x: 110, y: yOf(25) });
  });

  it("acorta los nombres largos", () => {
    const [label] = directLabels([{ id: "s", label: "Carla Fernanda", values: [80] }], xOf);
    expect(label?.text).toBe("Carla Ferna…");
  });

  it("separa etiquetas que caerían una sobre otra", () => {
    const labels = directLabels(
      [
        { id: "ana", label: "Ana", values: [40, 25] },
        { id: "avg", label: "Promedio de la clase", shortLabel: "Promedio", values: [50, 25] },
      ],
      xOf,
    );
    const [a, b] = labels;
    expect(Math.abs(a!.y - b!.y)).toBeGreaterThanOrEqual(LABEL_GAP);
  });

  it("se ubica en el último punto rendido y omite series vacías", () => {
    const labels = directLabels(
      [
        { id: "ana", label: "Ana", values: [40, null] },
        { id: "beto", label: "Beto", values: [null, null] },
      ],
      xOf,
    );
    expect(labels).toEqual([{ id: "ana", text: "Ana", x: 110, y: yOf(40) }]);
  });
});

describe("escala del eje vertical", () => {
  it("el logro va siempre de 0 a 100 en cuartos", () => {
    expect(scaleFor(40, 100).ticks).toEqual([0, 25, 50, 75, 100]);
  });

  it("para otras medidas elige pasos redondos que cubren el máximo", () => {
    expect(scaleFor(3.2).ticks).toEqual([0, 1, 2, 3, 4]);
    expect(scaleFor(7.5).ticks).toEqual([0, 2, 4, 6, 8]);
    expect(scaleFor(0.4).ticks).toEqual([0, 0.1, 0.2, 0.3, 0.4]);
    expect(scaleFor(0).ticks).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });

  it("ubica el tope arriba del área y el cero abajo", () => {
    const scale = scaleFor(3.2);
    expect(scale.yOf(scale.top)).toBe(M.top);
    expect(scale.yOf(0)).toBe(M.top + PLOT_H);
  });
});
