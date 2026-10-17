import { describe, expect, it } from "vitest";
import { LABEL_GAP, directLabels, yOf } from "./chartLayout";

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
