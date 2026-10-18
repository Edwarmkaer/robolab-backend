import { describe, expect, it, vi } from "vitest";
import { missionFixtures } from "../../domain/mission/fixtures";
import { MAX_GROQ_RESPONSE_BYTES } from "./groq";
import { DEFAULT_GEMINI_MODEL, GeminiProvider } from "./gemini";

const input = () => ({
  systemPrompt: "Devuelve JSON seguro.",
  request: { objective: "Practicar sumas.", grade: 2 as const },
  previousIssues: [],
  signal: new AbortController().signal,
});
const reply = (text: string, finishReason = "STOP") => Response.json({ candidates: [{ finishReason, content: { parts: [{ text }] } }] });

describe("adaptador Gemini (generateContent) sin red", () => {
  it("manda la clave en cabecera (no en la URL), pide JSON y envía los datos del docente como mensaje de usuario", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(reply(JSON.stringify(missionFixtures[0])));
    const provider = new GeminiProvider("clave-ficticia", "modelo-de-prueba", fetchImpl);
    expect(provider.name).toBe("gemini");
    expect(await provider.propose(input())).toEqual(missionFixtures[0]);
    const [url, options] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/modelo-de-prueba:generateContent");
    expect(String(url)).not.toContain("clave-ficticia");
    expect((options!.headers as Record<string, string>)["x-goog-api-key"]).toBe("clave-ficticia");
    const body = JSON.parse(options!.body as string);
    expect(body.systemInstruction.parts[0].text).toBe("Devuelve JSON seguro.");
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.maxOutputTokens).toBeLessThanOrEqual(8192);
    expect(body.contents[0].role).toBe("user");
    expect(body.contents[0].parts[0].text).toContain("Practicar sumas.");
    expect(body).not.toHaveProperty("tools");
    expect(options!.signal).toBeDefined();
  });

  it("usa un modelo Flash estable por defecto", () => {
    expect(DEFAULT_GEMINI_MODEL).toBe("gemini-3.1-flash-lite");
    expect(new GeminiProvider("k").model).toBe(DEFAULT_GEMINI_MODEL);
  });

  it("en una reparación manda los errores y la propuesta anterior como datos", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(reply(JSON.stringify(missionFixtures[0])));
    await new GeminiProvider("k", "m", fetchImpl).propose({
      ...input(),
      previousIssues: [{ code: "UNSOLVABLE", path: "mission", message: "No existe solución." }],
      previousProposal: { id: "viejo" },
    });
    const text = JSON.parse(fetchImpl.mock.calls[0]![1]!.body as string).contents[0].parts[0].text as string;
    expect(text).toContain("No existe solución.");
    expect(text).toContain("viejo");
  });

  it.each([401, 403, 429, 500, 503, 404])("normaliza el error HTTP %i sin filtrar cuerpo ni clave", async (status) => {
    const provider = new GeminiProvider("clave-ficticia", "m", vi.fn<typeof fetch>().mockResolvedValue(new Response("dato-secreto-del-proveedor", { status })));
    const error = (await provider.propose(input()).catch((e: unknown) => e)) as Error & { code: string };
    expect(error.code).toBe(status === 401 || status === 403 ? "PROVIDER_AUTH" : status === 429 ? "PROVIDER_RATE_LIMIT" : "PROVIDER_UNAVAILABLE");
    expect(error.message).not.toContain("dato-secreto");
    expect(error.message).not.toContain("clave-ficticia");
  });

  it("Gemini responde 400 cuando la clave no es válida: eso es un error de autorización, no de la propuesta", async () => {
    const body = JSON.stringify({ error: { status: "INVALID_ARGUMENT", details: [{ reason: "API_KEY_INVALID" }] } });
    const provider = new GeminiProvider("k", "m", vi.fn<typeof fetch>().mockResolvedValue(new Response(body, { status: 400 })));
    await expect(provider.propose(input())).rejects.toMatchObject({ code: "PROVIDER_AUTH" });
  });

  it("cualquier otro 400 se trata como respuesta inválida (se puede reparar)", async () => {
    const provider = new GeminiProvider("k", "m", vi.fn<typeof fetch>().mockResolvedValue(new Response("{}", { status: 400 })));
    await expect(provider.propose(input())).rejects.toMatchObject({ code: "SCHEMA_INVALID" });
  });

  it.each([
    ["no es JSON", reply("no es JSON")],
    ["cortada por tamaño", reply("{}", "MAX_TOKENS")],
    ["bloqueada por seguridad", reply("{}", "SAFETY")],
    ["sin candidatos", Response.json({ candidates: [] })],
    ["sin texto", Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [] } }] })],
    ["JSON que no es objeto", reply('"texto"')],
    ["sobre vacío", Response.json({})],
    ["cuerpo no JSON", new Response("cuerpo no JSON")],
  ])("rechaza una respuesta no confiable: %s", async (_name, res) => {
    await expect(new GeminiProvider("k", "m", vi.fn<typeof fetch>().mockResolvedValue(res)).propose(input())).rejects.toMatchObject({ code: "SCHEMA_INVALID" });
  });

  it("limita cuerpos incluso sin Content-Length", async () => {
    const res = new Response("x".repeat(MAX_GROQ_RESPONSE_BYTES + 1));
    await expect(new GeminiProvider("k", "m", vi.fn<typeof fetch>().mockResolvedValue(res)).propose(input())).rejects.toMatchObject({ code: "PROVIDER_RESPONSE_TOO_LARGE" });
  });

  it("sin clave configurada no llama a la red", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(new GeminiProvider("  ", "m", fetchImpl).propose(input())).rejects.toMatchObject({ code: "PROVIDER_NOT_CONFIGURED" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("propaga la cancelación a fetch y no filtra errores de red", async () => {
    const controller = new AbortController();
    controller.abort();
    const p = new GeminiProvider("k", "m", vi.fn<typeof fetch>().mockRejectedValue(new Error("error interno")));
    await expect(p.propose({ ...input(), signal: controller.signal })).rejects.toMatchObject({ code: "PROVIDER_TIMEOUT" });
  });

  it("los mensajes de error hablan de Gemini", async () => {
    const provider = new GeminiProvider("k", "m", vi.fn<typeof fetch>().mockResolvedValue(new Response("", { status: 429 })));
    const error = (await provider.propose(input()).catch((e: unknown) => e)) as Error;
    expect(error.message).toMatch(/Gemini/);
  });
});
