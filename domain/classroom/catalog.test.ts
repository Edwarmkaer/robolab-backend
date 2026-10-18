import { describe, expect, it } from "vitest";
import { CHALLENGES } from "../explore/challenges";
import { openChallenges } from "../explore/progress";
import { MISSIONS } from "../lab/mission";
import { CATALOG_KIND_LABEL, MISSION_DIFFICULTY, catalog, catalogItem } from "./catalog";

describe("catálogo de retos asignables", () => {
  it("incluye los retos de bloques de Inicial con su ficha y sin ids repetidos", () => {
    const items = catalog();
    const ids = items.map((i) => i.challengeId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of openChallenges()) {
      expect(items.find((i) => i.challengeId === c.id)).toMatchObject({ title: c.title, level: c.level, kind: c.kind, topic: c.topic });
    }
    for (const item of items) expect(item.kindLabel).toBe(CATALOG_KIND_LABEL[item.kind]);
  });

  it("incluye las misiones de Primaria como tipo «mission», sin tablero de bloques", () => {
    const items = catalog();
    for (const m of MISSIONS) {
      expect(items.find((i) => i.challengeId === m.id)).toMatchObject({
        title: m.title,
        topic: m.topic,
        level: "primaria",
        kind: "mission",
        kindLabel: "Misión",
        difficulty: MISSION_DIFFICULTY,
        emoji: m.emoji,
        story: m.story,
        hints: m.hints,
        map: null,
      });
    }
    // Un mismo id nunca es a la vez un reto de bloques y una misión.
    expect(items.filter((i) => i.kind === "mission")).toHaveLength(MISSIONS.length);
    expect(catalogItem(MISSIONS[0]!.id)?.kind).toBe("mission");
  });

  it("ofrece 54 retos: 28 de bloques en Inicial y 26 misiones en Primaria, que son las cantidades de Mi avance", () => {
    const items = catalog();
    expect(items).toHaveLength(54);
    expect(items.filter((i) => i.kind !== "mission").every((i) => i.level === "inicial")).toBe(true);
    expect(items.filter((i) => i.level === "primaria").every((i) => i.kind === "mission")).toBe(true);
  });

  it("los retos de bloques de Primaria ya no se ofrecen, pero una clase que los tiene asignados los sigue encontrando", () => {
    const legacy = CHALLENGES.filter((c) => c.level === "primaria");
    expect(legacy.length).toBeGreaterThan(0);
    for (const c of legacy) {
      expect(catalog().some((i) => i.challengeId === c.id), c.id).toBe(false);
      expect(catalogItem(c.id), c.id).toMatchObject({ title: c.title, level: "primaria", kind: c.kind });
    }
  });

  it("la ficha trae el tópico con nombre, el tipo con etiqueta y el tablero listo para dibujar", () => {
    expect(catalogItem("inicial-paseo")).toMatchObject({
      title: "Primer paseo",
      topicName: "Tecnología",
      kindLabel: "Secuencia",
      difficulty: 1,
      map: { rows: 1, cols: 4, layout: ["S..G"], start: { row: 0, col: 0 }, goal: { row: 0, col: 3 }, stops: [] },
    });
    expect(catalogItem("inicial-donde")?.map?.goal).toBeNull();
    expect(catalogItem("no-existe")).toBeUndefined();
  });
});
