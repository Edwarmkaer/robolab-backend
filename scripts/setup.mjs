#!/usr/bin/env node
/**
 * Deja listo un despliegue de Convex recién creado (`npx convex dev`):
 *
 *   JWT_PRIVATE_KEY y JWKS  claves para el inicio de sesión del docente
 *   SITE_URL                dirección de la web (por defecto la de `npm run dev`)
 *   MAIL_PROVIDER=console   el código para recuperar la contraseña sale en `npx convex logs`
 *
 * Solo agrega las variables que faltan; nunca reemplaza las que ya existen.
 * Uso: npm run setup            (o: npm run setup -- --site-url https://mi-app.pages.dev)
 */
import { spawnSync } from "node:child_process";
import { createPublicKey, generateKeyPairSync, randomBytes } from "node:crypto";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DEFAULT_SITE_URL = "http://localhost:5173";

const quote = (arg) => (/^[\w./:=-]+$/.test(arg) ? arg : `"${arg.replace(/"/g, '\\"')}"`);

function convex(args) {
  // npx en Windows es un .cmd: se ejecuta por la consola con el comando ya armado y entre comillas.
  const result = spawnSync(["npx", "convex", ...args].map(quote).join(" "), { encoding: "utf8", shell: true });
  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? "");
    throw new Error(`Falló: npx convex ${args[0]} ${args[1] ?? ""}`);
  }
  return result.stdout ?? "";
}

if (!existsSync(".env.local")) {
  console.error("Primero corre `npx convex dev` (crea el despliegue y el archivo .env.local) y vuelve a intentarlo.");
  process.exit(1);
}

const siteFlag = process.argv.indexOf("--site-url");
const siteUrl = siteFlag > 0 ? process.argv[siteFlag + 1] : DEFAULT_SITE_URL;

const existing = new Set(
  convex(["env", "list"])
    .split(/\r?\n/)
    .map((line) => line.split("=")[0]?.trim())
    .filter(Boolean),
);

const wanted = [];
if (!existing.has("JWT_PRIVATE_KEY") || !existing.has("JWKS")) {
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  const jwk = createPublicKey(privateKey).export({ format: "jwk" });
  // Convex Auth acepta la clave en una sola línea, con espacios en lugar de saltos.
  wanted.push(["JWT_PRIVATE_KEY", `"${privateKey.trimEnd().replace(/\n/g, " ")}"`]);
  wanted.push(["JWKS", `'${JSON.stringify({ keys: [{ use: "sig", ...jwk }] })}'`]);
}
if (!existing.has("SITE_URL")) wanted.push(["SITE_URL", siteUrl]);
if (!existing.has("MAIL_PROVIDER")) wanted.push(["MAIL_PROVIDER", "console"]);

if (wanted.length === 0) {
  console.log("El despliegue ya estaba listo: no se cambió nada.");
  process.exit(0);
}

// Un archivo temporal evita que la clave privada quede en el historial de la consola.
const file = join(tmpdir(), `robolab-env-${randomBytes(6).toString("hex")}`);
try {
  writeFileSync(file, wanted.map(([name, value]) => `${name}=${value}`).join("\n") + "\n", { mode: 0o600 });
  convex(["env", "set", "--from-file", file]);
} finally {
  rmSync(file, { force: true });
}
console.log(`Listo. Se configuró: ${wanted.map(([name]) => name).join(", ")}.`);
