/**
 * Edición del programa por toques (sin arrastrar), pensada para dedos de
 * niños y pantallas táctiles. Reducer puro: se prueba sin React.
 *
 * Un "repetir" queda abierto al colocarlo: los bloques siguientes entran en
 * él hasta que el alumno lo cierra.
 */
import { type Block, type BlockPath, type Command, MAX_BLOCKS, MAX_REPEAT, MIN_REPEAT, countBlocks, move } from "./program";

export type EditorState = {
  readonly blocks: readonly Block[];
  /** Índice raíz del "repetir" abierto, si hay uno. */
  readonly openRepeat: number | null;
};

export const emptyEditor: EditorState = { blocks: [], openRepeat: null };

export type EditorAction =
  | { type: "add"; command: Command }
  | { type: "addRepeat" }
  | { type: "closeRepeat" }
  | { type: "setTimes"; index: number; times: number }
  | { type: "remove"; path: BlockPath }
  | { type: "clear" };

const clampTimes = (n: number) => Math.min(MAX_REPEAT, Math.max(MIN_REPEAT, Math.round(n)));

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  const full = countBlocks(state.blocks) >= MAX_BLOCKS;
  switch (action.type) {
    case "add": {
      if (full) return state;
      const open = state.openRepeat === null ? undefined : state.blocks[state.openRepeat];
      if (open && open.kind === "repeat") {
        const blocks = state.blocks.map((b, i) =>
          i === state.openRepeat && b.kind === "repeat" ? { ...b, body: [...b.body, move(action.command)] } : b,
        );
        return { ...state, blocks };
      }
      return { ...state, blocks: [...state.blocks, move(action.command)] };
    }
    case "addRepeat": {
      if (full || state.openRepeat !== null) return state;
      return {
        blocks: [...state.blocks, { kind: "repeat", times: MIN_REPEAT, body: [] }],
        openRepeat: state.blocks.length,
      };
    }
    case "closeRepeat":
      return { ...state, openRepeat: null };
    case "setTimes":
      return {
        ...state,
        blocks: state.blocks.map((b, i) =>
          i === action.index && b.kind === "repeat" ? { ...b, times: clampTimes(action.times) } : b,
        ),
      };
    case "remove": {
      const [root, child] = action.path;
      if (root === undefined) return state;
      if (child === undefined) {
        const blocks = state.blocks.filter((_, i) => i !== root);
        const openRepeat =
          state.openRepeat === null || state.openRepeat === root
            ? null
            : state.openRepeat > root
              ? state.openRepeat - 1
              : state.openRepeat;
        return { blocks, openRepeat };
      }
      return {
        ...state,
        blocks: state.blocks.map((b, i) =>
          i === root && b.kind === "repeat" ? { ...b, body: b.body.filter((_, j) => j !== child) } : b,
        ),
      };
    }
    case "clear":
      return emptyEditor;
  }
}
