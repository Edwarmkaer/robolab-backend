import type { ButtonHTMLAttributes } from "react";
import { Icon, type IconName } from "./Icon";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label"> & {
  readonly icon: IconName;
  /** Lo que hace el botón: lo lee el lector de pantalla y aparece al pasar el cursor. */
  readonly label: string;
  readonly tone?: "neutral" | "danger";
};

/** Botón solo con ícono, siempre con su nombre accesible y su etiqueta flotante. */
export function IconButton({ icon, label, tone = "neutral", className, type = "button", ...rest }: Props) {
  return (
    <button
      {...rest}
      type={type}
      className={["icon-btn", tone === "danger" ? "icon-btn-danger" : "", className ?? ""].filter(Boolean).join(" ")}
      aria-label={label}
      data-tooltip={label}
    >
      <Icon name={icon} />
    </button>
  );
}
