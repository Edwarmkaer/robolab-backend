import { useAuthActions } from "@convex-dev/auth/react";
import { useAction } from "convex/react";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../convex/_generated/api";
import { RESET_CODE_LENGTH, maskEmail } from "../../../domain/auth/codes";
import { normalizeEmail } from "../../../domain/auth/email";
import { isStrongPassword } from "../../../domain/auth/password";
import { APP_NAME } from "../../../shared/brand";
import { userMessage } from "../../../shared/errors";
import { Icon } from "../../../shared/ui/Icon";
import { useToast } from "../../../shared/ui/Toast";
import { PasswordField } from "./PasswordField";

type View = "signIn" | "signUp" | "forgot" | "verify";

const RESEND_WAIT_MS = 60_000;

/** Segundos que faltan para `until`, actualizados cada segundo. */
function useSecondsUntil(until: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (until <= Date.now()) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [until]);
  return Math.max(0, Math.ceil((until - now) / 1000));
}

const HEADINGS: Record<View, { title: string; subtitle: string }> = {
  signIn: { title: "Hola de nuevo", subtitle: "Ingresa para ver tus clases y las evaluaciones de hoy." },
  signUp: { title: "Crea tu cuenta de docente", subtitle: "Toma menos de un minuto." },
  forgot: {
    title: "¿Olvidaste tu contraseña?",
    subtitle: "Escribe el correo con el que te registraste y te enviaremos un código de 6 dígitos.",
  },
  verify: { title: "Revisa tu correo", subtitle: "Escribe el código que te enviamos y elige una contraseña nueva." },
};

export function TeacherAuth() {
  const { signIn } = useAuthActions();
  const requestReset = useAction(api.passwordReset.request);
  const toast = useToast();

  const [view, setView] = useState<View>("signIn");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [resendAt, setResendAt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const resendIn = useSecondsUntil(resendAt);

  const go = (next: View) => {
    setView(next);
    setError(null);
  };

  async function attempt(work: () => Promise<void>, fallback: string) {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (e) {
      setError(userMessage(e, fallback));
    } finally {
      setBusy(false);
    }
  }

  async function sendCode(to: string) {
    const result = await requestReset({ email: to });
    setSentTo(result.sentTo);
    setResendAt(Date.now() + RESEND_WAIT_MS);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (view === "signIn") {
      void attempt(
        () => signIn("password", { flow: "signIn", email: normalizeEmail(email), password }).then(() => undefined),
        "Correo o contraseña incorrectos.",
      );
    } else if (view === "signUp") {
      void attempt(async () => {
        await signIn("password", { flow: "signUp", name, email: normalizeEmail(email), password });
        toast(`¡Listo, ${name.trim().split(" ")[0]}! Tu cuenta está creada.`);
      }, "No pudimos crear tu cuenta. ¿Ya tienes una con ese correo?");
    } else if (view === "forgot") {
      void attempt(async () => {
        await sendCode(email);
        setCode("");
        setNewPassword("");
        go("verify");
      }, "No pudimos enviar el código. Intenta de nuevo en unos minutos.");
    } else {
      void attempt(async () => {
        await signIn("password", { flow: "reset-verification", email: sentTo, code, newPassword });
        toast("Listo: cambiaste tu contraseña y ya ingresaste.");
      }, "El código no es correcto o ya venció. Revísalo o pide uno nuevo.");
    }
  }

  const canSubmit =
    view === "signUp"
      ? name.trim().length >= 2 && isStrongPassword(password)
      : view === "verify"
        ? code.length === RESET_CODE_LENGTH && isStrongPassword(newPassword)
        : true;

  const heading = HEADINGS[view];
  const submitLabel: Record<View, [string, string]> = {
    signIn: ["Ingresar", "Ingresando…"],
    signUp: ["Crear cuenta", "Creando tu cuenta…"],
    forgot: ["Enviar código", "Enviando…"],
    verify: ["Cambiar contraseña", "Cambiando…"],
  };

  let fields: ReactNode;
  if (view === "verify") {
    fields = (
      <>
        <p className="alert alert-ok row" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
          <Icon name="mail" />
          <span>
            Enviamos un código a <strong>{maskEmail(sentTo)}</strong>. Si no llega en unos minutos, revisa la carpeta de
            spam o correo no deseado.
          </span>
        </p>
        <div className="field">
          <label htmlFor="code">Código de {RESET_CODE_LENGTH} dígitos</label>
          <input
            key="code"
            id="code"
            className="input otp-input"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, RESET_CODE_LENGTH))}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern={`\\d{${RESET_CODE_LENGTH}}`}
            placeholder="000000"
            required
          />
        </div>
        <PasswordField
          id="new-password"
          name="newPassword"
          label="Contraseña nueva"
          value={newPassword}
          onChange={setNewPassword}
          autoComplete="new-password"
          showRules
        />
      </>
    );
  } else {
    fields = (
      <>
        {view === "signUp" && (
          <div className="field">
            <label htmlFor="name">Tu nombre</label>
            <input
              id="name"
              name="name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              placeholder="Rosa Quispe"
              required
              minLength={2}
            />
          </div>
        )}
        <div className="field">
          <label htmlFor="email">Correo</label>
          <input
            id="email"
            name="email"
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="docente@colegio.edu.pe"
            required
          />
        </div>
        {view !== "forgot" && (
          <PasswordField
            id="password"
            name="password"
            label="Contraseña"
            value={password}
            onChange={setPassword}
            autoComplete={view === "signIn" ? "current-password" : "new-password"}
            showRules={view === "signUp"}
          />
        )}
        {view === "signIn" && (
          <button type="button" className="link-btn" style={{ justifySelf: "end" }} onClick={() => go("forgot")}>
            ¿Olvidaste tu contraseña?
          </button>
        )}
      </>
    );
  }

  return (
    <main className="auth">
      <section className="card auth-card stack">
        <Link className="brand" to="/">
          <img src="/robot/robot.svg" alt="" />
          {APP_NAME}
        </Link>

        {(view === "signIn" || view === "signUp") && (
          <div className="segmented" role="group" aria-label="Elige una opción">
            <button type="button" aria-pressed={view === "signIn"} onClick={() => go("signIn")}>
              Ingresar
            </button>
            <button type="button" aria-pressed={view === "signUp"} onClick={() => go("signUp")}>
              Crear cuenta
            </button>
          </div>
        )}

        <div>
          <h1 className="auth-title">{heading.title}</h1>
          <p className="muted">{heading.subtitle}</p>
        </div>

        <form className="stack" onSubmit={onSubmit} noValidate={view === "verify"}>
          {fields}
          {error && (
            <p className="alert alert-error row" role="alert" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
              <Icon name="alert" />
              <span>{error}</span>
            </p>
          )}
          <button className="btn btn-primary" type="submit" disabled={busy || !canSubmit} aria-busy={busy}>
            {busy ? submitLabel[view][1] : submitLabel[view][0]}
          </button>
        </form>

        {view === "verify" && (
          <div className="row spread small">
            <button type="button" className="link-btn" onClick={() => go("forgot")}>
              Usar otro correo
            </button>
            <button
              type="button"
              className="link-btn"
              disabled={busy || resendIn > 0}
              onClick={() =>
                void attempt(async () => {
                  await sendCode(sentTo);
                  toast("Te enviamos un código nuevo.");
                }, "No pudimos enviar el código. Intenta de nuevo en unos minutos.")
              }
            >
              {resendIn > 0 ? `Reenviar código en ${resendIn} s` : "Reenviar código"}
            </button>
          </div>
        )}
        {view === "forgot" && (
          <button type="button" className="link-btn" style={{ justifySelf: "start" }} onClick={() => go("signIn")}>
            <Icon name="arrowLeft" size={18} /> Volver a ingresar
          </button>
        )}
      </section>
    </main>
  );
}
