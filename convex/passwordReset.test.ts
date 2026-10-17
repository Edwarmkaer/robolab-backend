import { convexTest } from "convex-test";
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

const EMAIL = "rosa@colegio.pe";
const PASSWORD = "Granja#2026";
const NEW_PASSWORD = "Estrella$77";

let keys: { JWT_PRIVATE_KEY: string; JWKS: string };

beforeAll(async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256", { extractable: true });
  const jwk = await exportJWK(publicKey);
  keys = {
    JWT_PRIVATE_KEY: (await exportPKCS8(privateKey)).trimEnd().replace(/\n/g, " "),
    JWKS: JSON.stringify({ keys: [{ use: "sig", ...jwk }] }),
  };
});

let logged: string[];

beforeEach(() => {
  vi.stubEnv("JWT_PRIVATE_KEY", keys.JWT_PRIVATE_KEY);
  vi.stubEnv("JWKS", keys.JWKS);
  vi.stubEnv("SITE_URL", "http://localhost:5198");
  vi.stubEnv("CONVEX_SITE_URL", "https://prueba.convex.site");
  vi.stubEnv("MAIL_PROVIDER", "console");
  logged = [];
  vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    logged.push(args.map(String).join(" "));
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const lastCode = () => {
  const match = /es: (\d{6})/.exec(logged.filter((l) => l.includes("[correo de desarrollo]")).at(-1) ?? "");
  if (!match) throw new Error("No se registró ningún correo con código");
  return match[1]!;
};

async function withTeacher() {
  const t = convexTest(schema, modules);
  await t.action(api.auth.signIn, {
    provider: "password",
    params: { flow: "signUp", email: "Rosa@Colegio.pe", password: PASSWORD, name: "Rosa" },
  });
  return t;
}

const signInWith = (t: Awaited<ReturnType<typeof withTeacher>>, password: string) =>
  t.action(api.auth.signIn, { provider: "password", params: { flow: "signIn", email: EMAIL, password } });

describe("contraseña del docente", () => {
  it("no deja registrarse con una contraseña débil y dice qué falta", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.action(api.auth.signIn, {
        provider: "password",
        params: { flow: "signUp", email: EMAIL, password: "granja2026", name: "Rosa" },
      }),
    ).rejects.toThrow(/necesita una mayúscula y un símbolo/);
  });

  it("recupera la contraseña con un código enviado al correo registrado", async () => {
    const t = await withTeacher();
    await expect(t.action(api.passwordReset.request, { email: " ROSA@colegio.pe " })).resolves.toEqual({ sentTo: EMAIL });

    const deliveries = await t.run((ctx) => ctx.db.query("emailDeliveries").collect());
    expect(deliveries).toMatchObject([{ to: EMAIL, kind: "password-reset", status: "sent", provider: "console" }]);

    const code = lastCode();
    const wrong = code === "000000" ? "111111" : "000000";
    await expect(
      t.action(api.auth.signIn, {
        provider: "password",
        params: { flow: "reset-verification", email: EMAIL, code: wrong, newPassword: NEW_PASSWORD },
      }),
    ).rejects.toThrow();
    await expect(
      t.action(api.auth.signIn, {
        provider: "password",
        params: { flow: "reset-verification", email: EMAIL, code, newPassword: "debil" },
      }),
    ).rejects.toThrow(/La contraseña necesita/);

    const result = await t.action(api.auth.signIn, {
      provider: "password",
      params: { flow: "reset-verification", email: EMAIL, code, newPassword: NEW_PASSWORD },
    });
    expect(result.tokens).toBeTruthy();

    await expect(signInWith(t, PASSWORD)).rejects.toThrow();
    expect((await signInWith(t, NEW_PASSWORD)).tokens).toBeTruthy();
  });

  it("avisa si el correo no tiene cuenta", async () => {
    const t = await withTeacher();
    await expect(t.action(api.passwordReset.request, { email: "nadie@colegio.pe" })).rejects.toThrow(
      /No hay una cuenta de docente con ese correo/,
    );
    await expect(t.action(api.passwordReset.request, { email: "no-es-correo" })).rejects.toThrow(/correo válido/);
  });

  it("no deja pedir códigos seguidos", async () => {
    const t = await withTeacher();
    await t.action(api.passwordReset.request, { email: EMAIL });
    await expect(t.action(api.passwordReset.request, { email: EMAIL })).rejects.toThrow(/Puedes pedir otro en \d+ segundos/);
  });

  it("si el correo no sale, lo dice y queda registrado como fallido", async () => {
    const t = await withTeacher();
    vi.stubEnv("MAIL_PROVIDER", "");
    await expect(t.action(api.passwordReset.request, { email: EMAIL })).rejects.toThrow(/no está configurado/);
    const deliveries = await t.run((ctx) => ctx.db.query("emailDeliveries").collect());
    expect(deliveries).toMatchObject([{ status: "failed" }]);

    // Un envío fallido no cuenta para la espera: se puede reintentar enseguida.
    vi.stubEnv("MAIL_PROVIDER", "console");
    await expect(t.action(api.passwordReset.request, { email: EMAIL })).resolves.toEqual({ sentTo: EMAIL });
  });
});
