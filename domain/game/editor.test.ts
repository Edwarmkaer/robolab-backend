import { describe, expect, it } from "vitest";
import { type EditorAction, editorReducer, emptyEditor } from "./editor";
import { MAX_BLOCKS, compile, compileWithSource, move, repeat } from "./program";

const run = (...actions: EditorAction[]) => actions.reduce(editorReducer, emptyEditor);

describe("editorReducer", () => {
  it("agrega movimientos en orden", () => {
    const s = run({ type: "add", command: "FORWARD" }, { type: "add", command: "TURN_LEFT" });
    expect(s.blocks).toEqual([move("FORWARD"), move("TURN_LEFT")]);
  });

  it("los bloques entran al repetir abierto hasta cerrarlo", () => {
    const s = run(
      { type: "addRepeat" },
      { type: "add", command: "FORWARD" },
      { type: "setTimes", index: 0, times: 3 },
      { type: "closeRepeat" },
      { type: "add", command: "TURN_RIGHT" },
    );
    expect(s.blocks).toEqual([repeat(3, [move("FORWARD")]), move("TURN_RIGHT")]);
    expect(compile(s.blocks)).toEqual(["FORWARD", "FORWARD", "FORWARD", "TURN_RIGHT"]);
  });

  it("no abre un repetir dentro de otro y limita las veces", () => {
    const s = run({ type: "addRepeat" }, { type: "addRepeat" }, { type: "setTimes", index: 0, times: 99 });
    expect(s.blocks).toHaveLength(1);
    expect(s.blocks[0]).toMatchObject({ kind: "repeat", times: 9 });
  });

  it("quitar un bloque raíz ajusta el repetir abierto", () => {
    let s = run({ type: "add", command: "FORWARD" }, { type: "addRepeat" });
    expect(s.openRepeat).toBe(1);
    s = editorReducer(s, { type: "remove", path: [0] });
    expect(s.openRepeat).toBe(0);
    s = editorReducer(s, { type: "remove", path: [0] });
    expect(s).toEqual(emptyEditor);
  });

  it("quita un bloque dentro del repetir", () => {
    const s = run(
      { type: "addRepeat" },
      { type: "add", command: "FORWARD" },
      { type: "add", command: "TURN_LEFT" },
      { type: "remove", path: [0, 0] },
    );
    expect(s.blocks).toEqual([repeat(2, [move("TURN_LEFT")])]);
  });

  it("no pasa el máximo de bloques", () => {
    let s = emptyEditor;
    for (let i = 0; i < MAX_BLOCKS + 5; i++) s = editorReducer(s, { type: "add", command: "FORWARD" });
    expect(s.blocks).toHaveLength(MAX_BLOCKS);
  });
});

describe("compileWithSource", () => {
  it("indica el bloque de origen de cada paso, también dentro de bucles", () => {
    const steps = compileWithSource([move("FORWARD"), repeat(2, [move("TURN_LEFT"), move("FORWARD")])]);
    expect(steps.map((s) => s.source)).toEqual([[0], [1, 0], [1, 1], [1, 0], [1, 1]]);
  });
});
