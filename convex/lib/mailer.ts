/**
 * Envío de correos (adaptador). El proveedor se elige con variables del
 * despliegue, nunca en el código:
 *
 * - MAIL_PROVIDER=resend, con RESEND_API_KEY y MAIL_FROM: envío real.
 * - MAIL_PROVIDER=console: solo para desarrollo local; el correo queda en
 *   los registros de Convex (`npx convex logs`).
 *
 * Sin configuración no se envía nada y se avisa: la app nunca dice "te
 * enviamos un código" si el correo no salió.
 */
import { type Env, deploymentEnv } from "./env";

export type EmailMessage = {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
};

export type Delivery = { readonly provider: "resend" | "console"; readonly messageId: string | null };

/** Error con un mensaje que se puede mostrar al docente tal cual. */
export class MailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MailError";
  }
}

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

const NOT_SENT = "No pudimos enviar el correo. Intenta de nuevo en unos minutos.";

export async function sendEmail(message: EmailMessage, env: Env = deploymentEnv(), fetchImpl: Fetch = fetch): Promise<Delivery> {
  switch (env.MAIL_PROVIDER) {
    case "resend":
      return await sendWithResend(message, env, fetchImpl);
    case "console":
      console.log(`[correo de desarrollo] Para: ${message.to} · ${message.subject}\n${message.text}`);
      return { provider: "console", messageId: null };
    default:
      throw new MailError("El envío de correos todavía no está configurado. Avísale a quien administra la app.");
  }
}

async function sendWithResend(message: EmailMessage, env: Env, fetchImpl: Fetch): Promise<Delivery> {
  if (!env.RESEND_API_KEY || !env.MAIL_FROM) {
    throw new MailError("El envío de correos todavía no está configurado. Avísale a quien administra la app.");
  }
  let response: Response;
  try {
    response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.MAIL_FROM,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });
  } catch (error) {
    console.error("Resend no respondió", error instanceof Error ? error.message : error);
    throw new MailError(NOT_SENT);
  }
  const body: unknown = await response.json().catch(() => null);
  const id = typeof body === "object" && body !== null && "id" in body && typeof body.id === "string" ? body.id : null;
  if (!response.ok || id === null) {
    // Se registra el estado, nunca la clave ni el contenido del correo.
    console.error(`Resend rechazó el envío: HTTP ${response.status}`);
    throw new MailError(NOT_SENT);
  }
  return { provider: "resend", messageId: id };
}
