/**
 * Estado del editor de preguntas como reducer puro, para probarlo sin React.
 */

export type QuestionDraft = {
  readonly key: string;
  readonly prompt: string;
  readonly options: readonly string[];
  readonly correctOption: number;
  readonly points: number;
};

export const MAX_OPTIONS = 4;
export const MIN_OPTIONS = 2;
export const MAX_QUESTIONS = 10;

let nextKey = 0;
const newKey = () => `q${++nextKey}`;

export const emptyQuestion = (): QuestionDraft => ({
  key: newKey(),
  prompt: "",
  options: ["", ""],
  correctOption: 0,
  points: 1,
});

export type DraftAction =
  | { type: "add" }
  | { type: "remove"; key: string }
  | { type: "prompt"; key: string; value: string }
  | { type: "option"; key: string; index: number; value: string }
  | { type: "addOption"; key: string }
  | { type: "removeOption"; key: string; index: number }
  | { type: "correct"; key: string; index: number }
  | { type: "points"; key: string; value: number };

const update = (drafts: readonly QuestionDraft[], key: string, fn: (q: QuestionDraft) => QuestionDraft) =>
  drafts.map((q) => (q.key === key ? fn(q) : q));

export function draftsReducer(drafts: readonly QuestionDraft[], action: DraftAction): readonly QuestionDraft[] {
  switch (action.type) {
    case "add":
      return drafts.length >= MAX_QUESTIONS ? drafts : [...drafts, emptyQuestion()];
    case "remove":
      return drafts.length <= 1 ? drafts : drafts.filter((q) => q.key !== action.key);
    case "prompt":
      return update(drafts, action.key, (q) => ({ ...q, prompt: action.value }));
    case "option":
      return update(drafts, action.key, (q) => ({
        ...q,
        options: q.options.map((o, i) => (i === action.index ? action.value : o)),
      }));
    case "addOption":
      return update(drafts, action.key, (q) =>
        q.options.length >= MAX_OPTIONS ? q : { ...q, options: [...q.options, ""] },
      );
    case "removeOption":
      return update(drafts, action.key, (q) => {
        if (q.options.length <= MIN_OPTIONS) return q;
        const options = q.options.filter((_, i) => i !== action.index);
        // Mantiene marcada la misma alternativa correcta si sigue existiendo.
        const correctOption =
          action.index === q.correctOption ? 0 : action.index < q.correctOption ? q.correctOption - 1 : q.correctOption;
        return { ...q, options, correctOption };
      });
    case "correct":
      return update(drafts, action.key, (q) => ({ ...q, correctOption: action.index }));
    case "points":
      return update(drafts, action.key, (q) => ({
        ...q,
        points: Number.isFinite(action.value) ? Math.round(action.value) : q.points,
      }));
  }
}

export const toPayload = (drafts: readonly QuestionDraft[]) =>
  drafts.map(({ prompt, options, correctOption, points }) => ({
    prompt,
    options: [...options],
    correctOption,
    points,
  }));
