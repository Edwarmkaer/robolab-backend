import { useId, useState } from "react";
import { checkPassword } from "../../../domain/auth/password";
import { Icon } from "../../../shared/ui/Icon";

type Props = {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly autoComplete: "current-password" | "new-password";
  /** Muestra la lista de requisitos que se marcan mientras se escribe. */
  readonly showRules?: boolean;
};

export function PasswordField({ id, name, label, value, onChange, autoComplete, showRules = false }: Props) {
  const [visible, setVisible] = useState(false);
  const rulesId = useId();
  const checks = checkPassword(value);

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="input-with-action">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          className="input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          autoCapitalize="none"
          spellCheck={false}
          required
          aria-describedby={showRules ? rulesId : undefined}
        />
        <button
          type="button"
          className="input-action"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={visible}
          data-tooltip={visible ? "Ocultar" : "Mostrar"}
        >
          <Icon name={visible ? "eyeOff" : "eye"} />
        </button>
      </div>
      {showRules && (
        <ul id={rulesId} className="rules" aria-label="La contraseña necesita">
          {checks.map((rule) => (
            <li key={rule.id} data-ok={rule.ok}>
              <Icon name={rule.ok ? "checkCircle" : "circle"} size={18} />
              <span>{rule.label}</span>
              <span className="sr-only">{rule.ok ? " (cumplido)" : " (falta)"}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
