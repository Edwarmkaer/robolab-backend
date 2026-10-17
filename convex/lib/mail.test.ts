import { describe, expect, it, vi } from "vitest";
import { MailError, sendEmail } from "./mailer";
import { HOUR_MS, MAX_PER_HOUR, RESEND_WAIT_MS, checkSendAllowed } from "./mailPolicy";

const message = { to: "rosa@colegio.pe", subject: "Código", text: "Tu código es 123456", html: "<p>123456</p>" };

describe("política de envío", () => {
  const now = 10 * HOUR_MS;

  it("permite el primer envío", () => {
    expect(checkSendAllowed([], now)).toEqual({ ok: true });
  });

  it("pide esperar un minuto entre códigos", () => {
    expect(checkSendAllowed([now - 20_000], now)).toEqual({ ok: false, retryInMs: RESEND_WAIT_MS - 20_000 });
    expect(checkSendAllowed([now - RESEND_WAIT_MS], now)).toEqual({ ok: true });
  });

  it("limita los envíos por hora", () => {
    const recent = Array.from({ length: MAX_PER_HOUR }, (_, i) => now - (i + 2) * 5 * 60_000);
    const result = checkSendAllowed(recent, now);
    expect(result.ok).toBe(false);
    // Se libera cuando el más antiguo cumple una hora.
    expect(!result.ok && result.retryInMs).toBe(Math.min(...recent) + HOUR_MS - now);
    expect(checkSendAllowed(recent.map((t) => t - HOUR_MS), now)).toEqual({ ok: true });
  });
});

describe("envío de correos", () => {
  it("sin configuración no finge que envió", async () => {
    await expect(sendEmail(message, {})).rejects.toThrow(MailError);
  });

  it("en modo consola (solo desarrollo) deja el correo en el registro", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await expect(sendEmail(message, { MAIL_PROVIDER: "console" })).resolves.toEqual({
      provider: "console",
      messageId: null,
    });
    expect(log.mock.calls.flat().join(" ")).toContain("123456");
    log.mockRestore();
  });

  it("con Resend confirma el envío con el id que devuelve el servicio", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "msg_1" }), { status: 200 }));
    const env = { MAIL_PROVIDER: "resend", RESEND_API_KEY: "re_test", MAIL_FROM: "Aula <aula@colegio.pe>" };
    await expect(sendEmail(message, env, fetchMock)).resolves.toEqual({ provider: "resend", messageId: "msg_1" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(JSON.parse(String(init.body))).toMatchObject({ to: ["rosa@colegio.pe"], from: "Aula <aula@colegio.pe>" });
  });

  it("si el servicio rechaza o no confirma, avisa que no se envió", async () => {
    const env = { MAIL_PROVIDER: "resend", RESEND_API_KEY: "re_test", MAIL_FROM: "aula@colegio.pe" };
    const rejected = vi.fn(async () => new Response("{}", { status: 422 }));
    await expect(sendEmail(message, env, rejected)).rejects.toThrow(MailError);
    const noId = vi.fn(async () => new Response("{}", { status: 200 }));
    await expect(sendEmail(message, env, noId)).rejects.toThrow(MailError);
    const offline = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(sendEmail(message, env, offline)).rejects.toThrow(MailError);
    await expect(sendEmail(message, { MAIL_PROVIDER: "resend" })).rejects.toThrow(MailError);
  });
});
