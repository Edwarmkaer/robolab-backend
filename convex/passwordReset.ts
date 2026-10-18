/**
 * Recuperar la contraseña con un código de 6 dígitos enviado al correo
 * registrado. Convex Auth guarda el código (cifrado), lo vence y limita los
 * intentos fallidos; aquí se arma el correo, se registra si salió y se
 * traducen los errores a mensajes claros.
 */
import { Email } from "@convex-dev/auth/providers/Email";
import { ConvexError, v } from "convex/values";
import { RESET_CODE_LENGTH, generateNumericCode } from "../domain/auth/codes";
import { normalizeEmail } from "../domain/auth/email";
import { APP_NAME } from "../domain/brand";
import { api, internal } from "./_generated/api";
import { type ActionCtx, action } from "./_generated/server";
import { MailError, sendEmail } from "./lib/mailer";

export const RESET_CODE_MINUTES = 15;

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

export function resetEmail(to: string, code: string) {
  const subject = `${code} es tu código para cambiar la contraseña`;
  const lines = [
    "Hola:",
    `Tu código para cambiar la contraseña de ${APP_NAME} es: ${code}`,
    `Vence en ${RESET_CODE_MINUTES} minutos.`,
    "Si no pediste el cambio, ignora este correo: tu contraseña sigue igual.",
  ];
  const html = `<div style="font-family:system-ui,sans-serif;font-size:16px;color:#1f2430">
<p>Hola:</p>
<p>Tu código para cambiar la contraseña de ${escapeHtml(APP_NAME)} es:</p>
<p style="font-size:32px;font-weight:800;letter-spacing:6px">${escapeHtml(code)}</p>
<p>Vence en ${RESET_CODE_MINUTES} minutos.</p>
<p style="color:#5d6475">Si no pediste el cambio, ignora este correo: tu contraseña sigue igual.</p>
</div>`;
  return { to, subject, text: lines.join("\n\n"), html };
}

const isActionCtx = (ctx: unknown): ctx is ActionCtx =>
  typeof ctx === "object" && ctx !== null && "runMutation" in ctx && typeof ctx.runMutation === "function";

/** Proveedor de Convex Auth para el paso "reset" del proveedor Password. */
export const PasswordResetEmail = Email({
  id: "password-reset",
  maxAge: RESET_CODE_MINUTES * 60,
  async generateVerificationToken() {
    return generateNumericCode(RESET_CODE_LENGTH);
  },
  // Convex Auth pasa el contexto de la acción como segundo argumento.
  async sendVerificationRequest({ identifier, token }, ctx?: unknown) {
    if (!isActionCtx(ctx)) throw new Error("Falta el contexto de Convex para registrar el envío.");
    const to = normalizeEmail(identifier);
    // `request` ya reservó el envío (y aplicó la política) antes de que Convex Auth creara el
    // código; si se llegó aquí por otro camino, se reserva ahora.
    const deliveryId =
      (await ctx.runQuery(internal.mail.claimPending, { to, kind: "password-reset" })) ??
      (await ctx.runMutation(internal.mail.reserve, { to, kind: "password-reset" }));
    try {
      const delivery = await sendEmail(resetEmail(to, token));
      await ctx.runMutation(internal.mail.settle, {
        deliveryId,
        status: "sent",
        provider: delivery.provider,
        ...(delivery.messageId ? { providerMessageId: delivery.messageId } : {}),
      });
    } catch (error) {
      await ctx.runMutation(internal.mail.settle, { deliveryId, status: "failed" });
      if (error instanceof MailError) throw new ConvexError(error.message);
      throw error;
    }
  },
});

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Paso 1: pedir el código. Responde solo cuando el correo salió; si no hay
 * una cuenta con ese correo o el envío falla, lo dice.
 */
export const request = action({
  args: { email: v.string() },
  handler: async (ctx, args): Promise<{ sentTo: string }> => {
    const email = normalizeEmail(args.email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ConvexError("Escribe un correo válido.");
    // La política de envío se aplica ANTES de pedirle el código a Convex Auth: al crear un
    // código nuevo, Convex Auth borra el anterior, y si el envío se rechazara después, la
    // docente se quedaría con un código en el correo que ya no sirve.
    const deliveryId = await ctx.runMutation(internal.mail.reserve, { to: email, kind: "password-reset" });
    try {
      await ctx.runAction(api.auth.signIn, { provider: "password", params: { email, flow: "reset" } });
    } catch (error) {
      // Sin correo enviado, la reserva no debe contar para la espera entre envíos.
      await ctx.runMutation(internal.mail.settle, { deliveryId, status: "failed" });
      if (error instanceof ConvexError) throw error;
      if (/InvalidAccountId/.test(message(error))) {
        throw new ConvexError("No hay una cuenta de docente con ese correo. Revisa cómo lo escribiste.");
      }
      console.error("No se pudo iniciar el cambio de contraseña:", message(error));
      throw new ConvexError("No pudimos enviar el código. Intenta de nuevo en unos minutos.");
    }
    return { sentTo: email };
  },
});
