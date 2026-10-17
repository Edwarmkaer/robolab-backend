import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

/**
 * Rutas que consulta el robot (ESP32). Respuestas en texto plano, fáciles de
 * leer desde Arduino. La clave va en el encabezado X-Clave (o en ?clave=).
 */
function robotCredentials(request: Request) {
  const url = new URL(request.url);
  return {
    code: url.searchParams.get("codigo") ?? "",
    key: request.headers.get("X-Clave") ?? url.searchParams.get("clave") ?? "",
  };
}

const text = (body: string | null, status: number) =>
  new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

// 200 con las letras del programa (ej. "AADAA"), 204 si no hay nada, 401 si la clave no corresponde.
http.route({
  path: "/robot/siguiente",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const result = await ctx.runMutation(internal.robot.takeNext, robotCredentials(request));
    if (!result.ok) return text("clave incorrecta\n", 401);
    return result.letters ? text(`${result.letters}\n`, 200) : text(null, 204);
  }),
});

// El robot avisa que terminó de ejecutar el último programa.
http.route({
  path: "/robot/hecho",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const result = await ctx.runMutation(internal.robot.markDone, robotCredentials(request));
    return result.ok ? text("ok\n", 200) : text("clave incorrecta\n", 401);
  }),
});

export default http;
