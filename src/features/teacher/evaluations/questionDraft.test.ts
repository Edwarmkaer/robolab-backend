import { describe, expect, it } from "vitest";
import { MAX_QUESTIONS, type QuestionDraft, draftsReducer, emptyQuestion, toPayload } from "./questionDraft";

describe("draftsReducer", () => {
  it("al quitar una alternativa conserva la respuesta correcta", () => {
    let drafts: readonly QuestionDraft[] = [{ ...emptyQuestion(), options: ["Perro", "Gato", "Pez"], correctOption: 2 }];
    const key = drafts[0]!.key;
    drafts = draftsReducer(drafts, { type: "removeOption", key, index: 0 });
    expect(drafts[0]).toMatchObject({ options: ["Gato", "Pez"], correctOption: 1 });
  });

  it("si se quita la alternativa correcta vuelve a la primera", () => {
    const start = [{ ...emptyQuestion(), options: ["A", "B", "C"], correctOption: 1 }];
    const after = draftsReducer(start, { type: "removeOption", key: start[0]!.key, index: 1 });
    expect(after[0]?.correctOption).toBe(0);
  });

  it("respeta los límites de alternativas y preguntas", () => {
    const one = [emptyQuestion()];
    const key = one[0]!.key;
    expect(draftsReducer(one, { type: "removeOption", key, index: 0 })[0]?.options).toHaveLength(2);
    expect(draftsReducer(one, { type: "remove", key })).toHaveLength(1);
    let many = one as ReturnType<typeof draftsReducer>;
    for (let i = 0; i < 20; i++) many = draftsReducer(many, { type: "add" });
    expect(many).toHaveLength(MAX_QUESTIONS);
  });

  it("deja vaciar el puntaje mientras se escribe y lo redondea al escribir", () => {
    const one = [emptyQuestion()];
    const key = one[0]!.key;
    const empty = draftsReducer(one, { type: "points", key, value: Number.NaN });
    expect(empty[0]?.points).toBeNaN();
    expect(draftsReducer(empty, { type: "points", key, value: 2.6 })[0]?.points).toBe(3);
  });

  it("mueve preguntas sin salirse de la lista", () => {
    const [a, b, c] = [emptyQuestion(), emptyQuestion(), emptyQuestion()];
    const drafts = [a!, b!, c!];
    expect(draftsReducer(drafts, { type: "move", key: c!.key, by: -1 }).map((q) => q.key)).toEqual([a!.key, c!.key, b!.key]);
    expect(draftsReducer(drafts, { type: "move", key: a!.key, by: -1 })).toBe(drafts);
    expect(draftsReducer(drafts, { type: "move", key: c!.key, by: 1 })).toBe(drafts);
  });

  it("deshace una pregunta eliminada en su mismo lugar", () => {
    const [a, b, c] = [emptyQuestion(), emptyQuestion(), emptyQuestion()];
    const removed = draftsReducer([a!, b!, c!], { type: "remove", key: b!.key });
    const restored = draftsReducer(removed, { type: "restore", question: b!, index: 1 });
    expect(restored.map((q) => q.key)).toEqual([a!.key, b!.key, c!.key]);
    // No duplica si ya estaba ni pasa del máximo.
    expect(draftsReducer(restored, { type: "restore", question: b!, index: 1 })).toBe(restored);
  });

  it("produce el formato que espera el servidor, sin claves internas", () => {
    const [q] = [{ ...emptyQuestion(), prompt: "¿Qué animal maúlla?", options: ["Gato", "Vaca"], points: 2 }];
    expect(toPayload([q!])).toEqual([{ prompt: "¿Qué animal maúlla?", options: ["Gato", "Vaca"], correctOption: 0, points: 2 }]);
  });
});
