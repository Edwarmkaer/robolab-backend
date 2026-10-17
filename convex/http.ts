import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { deploymentEnv } from "./lib/env";

const http = httpRouter();

auth.addHttpRoutes(http);

// ---------- Robot (ESP32): se autentica con su clave en el encabezado X-Clave ----------

const robotKey = (request: Request) =>
  request.headers.get("X-Clave") ?? new URL(request.url).searchParams.get("clave") ?? "";

const text = (body: string | null, status: number, headers: Record<string, string> = {}) =>
  new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", ...headers } });

const json = (body: unknown, status: number, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers },
  });

/**
 * El siguiente programa. Por defecto, texto sin saltos de línea ("AADZAA"), como dice el contrato.
 * ?formato=array → ["A","A","D","Z","A","A"]   ?formato=json → {"id","secuencia","pasos"}
 * 204 si no hay nada; 401 si la clave no corresponde.
 */
http.route({
  path: "/robot/siguiente",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const result = await ctx.runMutation(internal.robot.takeNext, { key: robotKey(request) });
    if (!result.ok) return text("clave incorrecta", 401);
    if (!result.letters || !result.id) return text(null, 204);
    const steps = [...result.letters];
    const idHeader = { "X-Id": result.id };
    switch (new URL(request.url).searchParams.get("formato")) {
      case "array":
        return json(steps, 200, idHeader);
      case "json":
        return json({ id: result.id, secuencia: result.letters, pasos: steps }, 200, idHeader);
      default:
        return text(result.letters, 200, idHeader);
    }
  }),
});

// Respuesta del robot sobre el último programa: OK, RUN, DONE o ERR:<código>.
http.route({
  path: "/robot/estado",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const result = await ctx.runMutation(internal.robot.report, { key: robotKey(request), reply: await request.text() });
    if (result.ok) return text("ok", 200);
    return result.reason === "unauthorized" ? text("clave incorrecta", 401) : text("respuesta no válida", 400);
  }),
});

// Código de emparejamiento vigente, para mostrarlo en el robot. X-Vence-En: segundos que le quedan.
http.route({
  path: "/robot/codigo",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const result = await ctx.runMutation(internal.robot.currentCode, { key: robotKey(request) });
    if (!result.ok) return text("clave incorrecta", 401);
    return text(result.code, 200, { "X-Vence-En": String(Math.max(0, Math.round((result.expiresAt - Date.now()) / 1000))) });
  }),
});

// ---------- Otras webs (por ejemplo, la desplegada en Vercel): CORS por lista ----------

function allowedOrigin(request: Request): string | null {
  const origin = request.headers.get("Origin");
  if (!origin) return null;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  const allowed = (deploymentEnv().ROBOT_WEB_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  return allowed.includes(origin) ? origin : null;
}

function cors(request: Request): Record<string, string> {
  const origin = allowedOrigin(request);
  return origin
    ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "600",
        Vary: "Origin",
      }
    : {};
}

const preflight = httpAction(async (_ctx, request) => new Response(null, { status: 204, headers: cors(request) }));
http.route({ path: "/robot/web/enviar", method: "OPTIONS", handler: preflight });
http.route({ path: "/robot/web/estado", method: "OPTIONS", handler: preflight });

// {"codigo":"SR965H","secuencia":"AADZAA","id":"<id único del envío>"} → {"estado":"EN_COLA","id":…}
http.route({
  path: "/robot/web/enviar",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = (await request.json().catch(() => null)) as { codigo?: unknown; secuencia?: unknown; id?: unknown } | null;
    if (!body || typeof body.codigo !== "string" || typeof body.secuencia !== "string") {
      return json({ estado: "ERR:BAD_REQUEST" }, 400, cors(request));
    }
    const { status, ...result } = await ctx.runMutation(internal.robot.webSend, {
      code: body.codigo,
      sequence: body.secuencia,
      ...(typeof body.id === "string" ? { requestId: body.id } : {}),
    });
    return json(result, status, cors(request));
  }),
});

// ?codigo=SR965H&id=<id del envío> → {"estado":"OK"|"RUN"|"DONE"|"ERR:…","conectado":true,…}
http.route({
  path: "/robot/web/estado",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const { status, ...result } = await ctx.runQuery(internal.robot.webStatus, {
      code: url.searchParams.get("codigo") ?? "",
      ...(id ? { requestId: id } : {}),
    });
    return json(result, status, cors(request));
  }),
});

export default http;
