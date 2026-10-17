import { useMutation } from "convex/react";
import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import { ACCESS_CODE_LENGTH, normalizeAccessCode } from "../../domain/evaluation/accessCode";
import { userMessage } from "../../shared/errors";

export function StudentLogin({ onSignedIn }: { onSignedIn: (token: string) => void }) {
  const signIn = useMutation(api.student.signIn);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { token } = await signIn({ code });
      onSignedIn(token);
    } catch (e) {
      setError(userMessage(e));
      setBusy(false);
    }
  }

  const ready = normalizeAccessCode(code).length === ACCESS_CODE_LENGTH;

  return (
    <main className="hero kid">
      <form className="card stack" style={{ width: "min(480px, 100%)", textAlign: "center" }} onSubmit={onSubmit}>
        <img src="/robot/robot.svg" alt="" style={{ width: 120, margin: "0 auto" }} />
        <h1>¡Hola!</h1>
        <label htmlFor="code">Escribe tu código</label>
        <input
          id="code"
          className="input code-input"
          value={code}
          onChange={(e) => setCode(normalizeAccessCode(e.target.value).slice(0, ACCESS_CODE_LENGTH))}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          inputMode="text"
          placeholder="ABC234"
          aria-describedby={error ? "code-error" : undefined}
        />
        {error && (
          <p id="code-error" className="alert alert-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn-primary" type="submit" disabled={!ready || busy}>
          {busy ? "Entrando…" : "Entrar"}
        </button>
        <Link to="/" className="small">
          Volver
        </Link>
      </form>
    </main>
  );
}
