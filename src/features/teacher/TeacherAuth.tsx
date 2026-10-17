import { useAuthActions } from "@convex-dev/auth/react";
import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { userMessage } from "../../shared/errors";

type Mode = "signIn" | "signUp";

export function TeacherAuth() {
  const { signIn } = useAuthActions();
  const [mode, setMode] = useState<Mode>("signIn");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    form.set("flow", mode);
    setBusy(true);
    setError(null);
    try {
      await signIn("password", form);
    } catch (e) {
      setError(
        userMessage(
          e,
          mode === "signIn"
            ? "Correo o contraseña incorrectos."
            : "No pudimos crear tu cuenta. ¿Ya tienes una con ese correo?",
        ),
      );
      setBusy(false);
    }
  }

  return (
    <main className="hero">
      <div className="card stack" style={{ width: "min(440px, 100%)" }}>
        <Link className="brand" to="/">
          <img src="/robot/robot.svg" alt="" />
          Inrobit Aula
        </Link>
        <h1>{mode === "signIn" ? "Ingresa como docente" : "Crea tu cuenta de docente"}</h1>
        <form className="stack" onSubmit={onSubmit}>
          {mode === "signUp" && (
            <div className="field">
              <label htmlFor="name">Nombre</label>
              <input id="name" name="name" className="input" autoComplete="name" required minLength={2} />
            </div>
          )}
          <div className="field">
            <label htmlFor="email">Correo</label>
            <input id="email" name="email" type="email" className="input" autoComplete="email" required />
          </div>
          <div className="field">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              name="password"
              type="password"
              className="input"
              autoComplete={mode === "signIn" ? "current-password" : "new-password"}
              required
              minLength={8}
            />
            {mode === "signUp" && <span className="small muted">Mínimo 8 caracteres.</span>}
          </div>
          {error && (
            <p className="alert alert-error" role="alert">
              {error}
            </p>
          )}
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "Un momento…" : mode === "signIn" ? "Ingresar" : "Crear cuenta"}
          </button>
        </form>
        <button
          className="btn btn-ghost"
          type="button"
          onClick={() => {
            setMode(mode === "signIn" ? "signUp" : "signIn");
            setError(null);
          }}
        >
          {mode === "signIn" ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Ingresa"}
        </button>
      </div>
    </main>
  );
}
