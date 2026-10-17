#!/usr/bin/env node
/**
 * Robot simulado: se comporta como el ESP32 del contrato para probar sin placa.
 * Muestra su código de emparejamiento, recoge cada programa, responde OK, RUN y
 * DONE, e imprime el recorrido (D gira a la izquierda: dir+270; Z a la derecha: dir+90).
 *
 * Uso:
 *   npm run robot:simulador -- --clave <clave del robot> [--servidor https://….convex.site] [--array] [--paso 300]
 * Sin --servidor usa CONVEX_SITE_URL de .env.local (el backend local).
 * Ctrl+C para salir.
 */
import { existsSync, readFileSync } from "node:fs";

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};

function localSiteUrl() {
  if (!existsSync(".env.local")) return undefined;
  const line = readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .find((l) => /^(VITE_)?CONVEX_SITE_URL=/.test(l));
  return line?.split("=")[1]?.trim();
}

const server = (arg("servidor") ?? localSiteUrl() ?? "").replace(/\/$/, "");
const key = arg("clave") ?? process.env.ROBOT_CLAVE ?? "";
const asArray = process.argv.includes("--array");
const stepMs = Number(arg("paso") ?? 300);

if (!server || !/^[0-9a-f]{32}$/.test(key)) {
  console.error("Falta --clave (32 caracteres hexadecimales) o la dirección del servidor (--servidor).");
  process.exit(1);
}

const headers = { "X-Clave": key };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const reply = (message) => fetch(`${server}/robot/estado`, { method: "POST", headers, body: message });

const NAMES = { 0: "arriba", 90: "derecha", 180: "abajo", 270: "izquierda" };
const DELTA = { 0: [-1, 0], 90: [0, 1], 180: [1, 0], 270: [0, -1] };

async function showCode() {
  const res = await fetch(`${server}/robot/codigo`, { headers });
  if (res.status === 401) throw new Error("Clave incorrecta");
  console.log(`Código del robot: ${await res.text()} (vence en ${res.headers.get("X-Vence-En")} s)`);
}

async function run(letters) {
  let dir = 0;
  let row = 0;
  let col = 0;
  await reply("OK");
  await reply("RUN");
  for (const letter of letters) {
    if (letter === "A" || letter === "R") {
      const [dr, dc] = DELTA[dir];
      const sign = letter === "A" ? 1 : -1;
      row += sign * dr;
      col += sign * dc;
    } else {
      dir = (dir + (letter === "D" ? 270 : 90)) % 360;
    }
    console.log(`  ${letter} → fila ${row}, columna ${col}, mirando a la ${NAMES[dir]}`);
    await sleep(stepMs);
  }
  await reply("DONE");
  console.log("  DONE");
}

await showCode();
console.log(`Esperando programas en ${server} …`);
for (;;) {
  try {
    const res = await fetch(`${server}/robot/siguiente${asArray ? "?formato=array" : ""}`, { headers });
    if (res.status === 200) {
      const body = await res.text();
      const letters = asArray ? JSON.parse(body).join("") : body;
      console.log(`Programa recibido: ${body}`);
      await run(letters);
    } else if (res.status === 401) {
      throw new Error("Clave incorrecta");
    }
  } catch (error) {
    if (error instanceof Error && error.message === "Clave incorrecta") throw error;
    console.log("Sin respuesta del servidor; reintentando…");
  }
  await sleep(500);
}
