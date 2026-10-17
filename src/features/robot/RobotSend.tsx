import { useMutation, useQuery } from "convex/react";
import { type FormEvent, useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Program } from "../../domain/game/program";
import { ROBOT_CODE_LENGTH, isValidRobotCode, normalizeRobotCode } from "../../domain/robot/protocol";
import { userMessage } from "../../shared/errors";
import { useToast } from "../../shared/ui/Toast";

const ROBOT_KEY = "robolab.robot";
/** El robot consulta cada medio segundo; si no aparece en 10 s, está apagado o sin wifi. */
const ONLINE_MS = 10_000;

function readLinked(): string {
  try {
    return window.localStorage.getItem(ROBOT_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeLinked(code: string) {
  try {
    if (code) window.localStorage.setItem(ROBOT_KEY, code);
    else window.localStorage.removeItem(ROBOT_KEY);
  } catch {
    // Sin almacenamiento, el robot queda vinculado solo mientras dure la pestaña.
  }
}

const STEP_TEXT = {
  pending: "Esperando al robot…",
  sent: "El robot lo recogió…",
  received: "El robot recibió el programa.",
  running: "El robot lo está haciendo…",
  done: "¡El robot terminó!",
  failed: "El robot avisó un problema",
  replaced: "Se envió otro programa después.",
  expired: "El robot no respondió.",
} as const;

const ROBOT_ERRORS: Record<string, string> = {
  BAD_CHAR: "una letra no válida",
  TOO_LONG: "el programa es muy largo",
  BUSY: "estaba ocupado",
  MOTOR: "falla de motor",
};

/** Enviar el programa al robot físico (ESP32 por wifi), además de verlo en pantalla. */
export function RobotSend({ program, disabled }: { program: Program; disabled: boolean }) {
  const [code, setCode] = useState(readLinked);
  const [draft, setDraft] = useState("");
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const toast = useToast();
  const send = useMutation(api.robot.send);
  const status = useQuery(api.robot.status, code ? { code } : "skip");
  const checking = useQuery(api.robot.status, linking && isValidRobotCode(draft) ? { code: draft } : "skip");

  // Reloj para saber si el robot sigue conectado.
  useEffect(() => {
    if (!code) return;
    const timer = window.setInterval(() => setNow(Date.now()), 2000);
    return () => window.clearInterval(timer);
  }, [code]);

  function link(event: FormEvent) {
    event.preventDefault();
    if (!checking) {
      setError("No encontramos ese robot. Revisa el código de su etiqueta.");
      return;
    }
    writeLinked(draft);
    setCode(draft);
    setLinking(false);
    setError(null);
    toast(`Conectado a ${checking.name}.`);
  }

  async function sendProgram() {
    setBusy(true);
    setError(null);
    try {
      // Un id por envío: si la red reintenta, el robot no lo hace dos veces.
      const result = await send({ code, program: [...program], requestId: crypto.randomUUID() });
      toast(`Enviado a ${result.robotName}: ${result.letters}`);
    } catch (e) {
      setError(userMessage(e, "No pudimos enviar el programa al robot."));
    } finally {
      setBusy(false);
    }
  }

  if (!code || linking) {
    return linking ? (
      <form className="robot-panel" onSubmit={link}>
        <label htmlFor="robot-code" className="label">
          Código del robot
        </label>
        <div className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
          <input
            id="robot-code"
            className="input code"
            value={draft}
            onChange={(e) => setDraft(normalizeRobotCode(e.target.value).slice(0, ROBOT_CODE_LENGTH))}
            placeholder="K7Q4MZ"
            autoComplete="off"
            spellCheck={false}
          />
          <button className="btn btn-sm btn-primary" type="submit" disabled={!isValidRobotCode(draft) || checking === undefined}>
            Conectar
          </button>
          <button className="btn btn-sm btn-ghost" type="button" onClick={() => setLinking(false)}>
            Cancelar
          </button>
        </div>
        <span className="hint">Es el código de 6 letras que muestra el robot. El robot necesita wifi con internet.</span>
        {error && <span className="field-error">{error}</span>}
      </form>
    ) : (
      <button className="btn btn-sm" type="button" onClick={() => setLinking(true)}>
        🤖 Conectar un robot
      </button>
    );
  }

  const online = status?.lastSeenAt != null && now - status.lastSeenAt < ONLINE_MS;
  const expired = status != null && status.codeExpiresAt <= now;
  const last = status?.lastCommand;

  return (
    <div className="robot-panel">
      <div className="row spread" style={{ gap: 8 }}>
        <span className="robot-state" data-online={online}>
          <span aria-hidden="true" className="dot" />
          {status === undefined
            ? "Buscando robot…"
            : status === null
              ? "Robot no encontrado"
              : expired
                ? `${status.name} · el código venció`
                : `${status.name} · ${online ? "conectado" : "sin señal"}`}
        </span>
        <button className="link-btn small" type="button" onClick={() => setLinking(true)}>
          Cambiar
        </button>
      </div>
      {expired && <span className="hint">El robot muestra un código nuevo cada 12 horas. Toca «Cambiar» y escríbelo.</span>}
      <button
        className="btn btn-sm"
        type="button"
        disabled={disabled || busy || program.length === 0 || !status || expired}
        onClick={() => void sendProgram()}
        aria-busy={busy}
      >
        🤖 Enviar al robot
      </button>
      {last && (
        <span className="small muted" role="status">
          <span className="code">{last.letters}</span> · {STEP_TEXT[last.status]}
          {last.status === "failed" && `: ${ROBOT_ERRORS[last.error ?? ""] ?? last.error ?? "sin detalle"}.`}
        </span>
      )}
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}
