import type { Dispatch } from "react";
import type { EditorAction, EditorState } from "../../domain/game/editor";
import { COMMANDS, type BlockPath, MAX_REPEAT, MIN_REPEAT } from "../../domain/game/program";
import type { LevelPolicy } from "../../domain/game/levels";
import { Icon } from "../../shared/ui/Icon";
import { speak } from "../student/speech";
import { BLOCK_LOOK, REPEAT_LOOK } from "./blocks";

type Props = {
  readonly policy: LevelPolicy;
  readonly state: EditorState;
  readonly dispatch: Dispatch<EditorAction>;
  readonly disabled: boolean;
  /** Bloque que se ejecuta ahora o el que falló, para resaltarlo. */
  readonly active?: { path: BlockPath; tone: "active" | "error" } | null;
};

const samePath = (a: BlockPath, b: BlockPath) => a.length === b.length && a.every((v, i) => v === b[i]);

export function BlockEditor({ policy, state, dispatch, disabled, active }: Props) {
  const commands = COMMANDS.filter((c) => policy.palette.has(c));
  const toneOf = (path: BlockPath) => (active && samePath(active.path, path) ? active.tone : undefined);
  // Número de paso visible de cada bloque raíz (los bucles no cuentan como paso).
  const stepNumbers = state.blocks.reduce<number[]>((acc, block) => {
    const last = acc.length === 0 ? 0 : acc[acc.length - 1]!;
    acc.push(block.kind === "move" ? last + 1 : last);
    return acc;
  }, []);

  return (
    <div className="stack">
      <div className="palette" role="group" aria-label="Bloques disponibles">
        {commands.map((command) => (
          <button
            key={command}
            type="button"
            className="block-btn"
            disabled={disabled}
            onClick={() => {
              dispatch({ type: "add", command });
              speak(BLOCK_LOOK[command].label);
            }}
          >
            <img src={BLOCK_LOOK[command].icon} alt="" />
            {BLOCK_LOOK[command].label}
          </button>
        ))}
        {policy.palette.has("repeat") && (
          <button
            type="button"
            className="block-btn"
            disabled={disabled || state.openRepeat !== null}
            onClick={() => dispatch({ type: "addRepeat" })}
          >
            <img src={REPEAT_LOOK.icon} alt="" />
            {REPEAT_LOOK.label}
          </button>
        )}
      </div>

      <div className="program" role="list" aria-label="Tu programa">
        {state.blocks.length === 0 && <span className="muted">Toca los bloques para armar tu programa.</span>}
        {state.blocks.map((block, i) => {
          if (block.kind === "move") {
            const stepNumber = stepNumbers[i];
            return (
              <button
                key={i}
                type="button"
                role="listitem"
                className="program-block"
                data-state={toneOf([i])}
                disabled={disabled}
                aria-label={`Paso ${stepNumber}: ${BLOCK_LOOK[block.command].label}. Toca para quitar.`}
                onClick={() => dispatch({ type: "remove", path: [i] })}
              >
                <span className="step-n">{stepNumber}</span>
                <img src={BLOCK_LOOK[block.command].icon} alt="" />
              </button>
            );
          }
          const open = state.openRepeat === i;
          return (
            <div key={i} role="listitem" className="repeat-block">
              <strong className="small">Repetir</strong>
              <select
                className="select"
                style={{ width: 70, minHeight: 36, padding: "4px 8px" }}
                value={block.times}
                disabled={disabled}
                aria-label="Veces"
                onChange={(e) => dispatch({ type: "setTimes", index: i, times: Number(e.target.value) })}
              >
                {Array.from({ length: MAX_REPEAT - MIN_REPEAT + 1 }, (_, k) => k + MIN_REPEAT).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              {block.body.map((child, j) =>
                child.kind === "move" ? (
                  <button
                    key={j}
                    type="button"
                    className="program-block"
                    data-state={toneOf([i, j])}
                    disabled={disabled}
                    aria-label={`${BLOCK_LOOK[child.command].label} dentro de repetir. Toca para quitar.`}
                    onClick={() => dispatch({ type: "remove", path: [i, j] })}
                  >
                    <img src={BLOCK_LOOK[child.command].icon} alt="" />
                  </button>
                ) : null,
              )}
              {open ? (
                <button className="btn" type="button" disabled={disabled} onClick={() => dispatch({ type: "closeRepeat" })}>
                  Cerrar
                </button>
              ) : (
                <button
                  className="btn btn-ghost"
                  type="button"
                  disabled={disabled}
                  aria-label="Quitar repetir"
                  onClick={() => dispatch({ type: "remove", path: [i] })}
                >
                  <Icon name="x" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
