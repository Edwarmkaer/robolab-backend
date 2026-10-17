import type { GameMap } from "../../domain/game/map";
import type { RobotState } from "../../domain/game/simulator";

type Props = {
  readonly map: GameMap;
  readonly robot: RobotState;
  readonly mood: "idle" | "error" | "success";
  readonly stepMs: number;
};

const ROBOT_IMAGE = { idle: "/robot/robot.svg", error: "/robot/robot-error.svg", success: "/robot/robot-exito.svg" };
// La imagen del robot mira hacia abajo; se gira para que coincida con su orientación.
const IMAGE_OFFSET_DEG = 180;

const PADDING_PX = 10; // igual que .board en styles.css
const GAP_PX = 4;

/** Posición y tamaño de una celda dentro del tablero, con su relleno y separaciones. */
const along = (index: number, count: number) => {
  const fixed = 2 * PADDING_PX + (count - 1) * GAP_PX;
  const size = `((100% - ${fixed}px) / ${count})`;
  return { offset: `calc(${PADDING_PX}px + ${index} * (${size} + ${GAP_PX}px))`, size: `calc${size}` };
};

export function Board({ map, robot, mood, stepMs }: Props) {
  const x = along(robot.cell.col, map.cols);
  const y = along(robot.cell.row, map.rows);
  return (
    <div
      className="board"
      style={{ gridTemplateColumns: `repeat(${map.cols}, 1fr)`, ["--step-ms" as string]: `${stepMs}ms` }}
      role="img"
      aria-label={`Mapa de ${map.rows} por ${map.cols}. El robot debe llegar a la estrella.`}
    >
      {map.layout.flatMap((line, row) =>
        [...line].map((ch, col) => (
          <div key={`${row}-${col}`} className="tile" data-walkable={ch !== "#"}>
            {ch === "G" && <img className="star" src="/estrella.svg" alt="" />}
          </div>
        )),
      )}
      <div
        className="robot"
        style={{
          left: x.offset,
          top: y.offset,
          width: x.size,
          height: y.size,
          transform: `rotate(${robot.heading + IMAGE_OFFSET_DEG}deg)`,
        }}
      >
        <img src={ROBOT_IMAGE[mood]} alt="" />
      </div>
    </div>
  );
}
