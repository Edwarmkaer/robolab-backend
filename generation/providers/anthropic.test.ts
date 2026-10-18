import { describe, expect, it, vi } from "vitest";
import { missionFixtures } from "../../domain/mission/fixtures";
import { AnthropicProvider, DEFAULT_ANTHROPIC_MODEL } from "./anthropic";
import { MAX_GROQ_RESPONSE_BYTES } from "./groq";

const input = () => ({
  systemPrompt: "Devuelve JSON seguro.",
  request: { objective: "Practicar sumas.", grade: 2 as const },
  previousIssues: [],
  signal: new AbortController().signal,
});
const reply = (content: unknown[], stop_reason = "tool_use") => Response.json({ stop_reason, content });
const tool = (value: unknown) => reply([{ type: "tool_use", id: "t1", name: "propose_mission", input: value }]);

describe("adaptador Anthropic (Messages API) sin red", () => {
  it("envía la clave en cabecera, fuerza la herramienta de salida y manda los datos del docente como mensaje de usuario", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(tool(missionFixtures[0]));
    const provider = new AnthropicProvider("clave-ficticia", "modelo-de-prueba", fetchImpl);
    expect(provider.name).toBe("anthropic");
    expect(await provider.propose(input())).toEqual(missionFixtures[0]);
    const [url, options] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    const headers = options!.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("clave-ficticia");
    expect(headers["anthropic-version"]).toBe("2023-06-01");
    const body = JSON.parse(options!.body as string);
    expect(body.model).toBe("modelo-de-prueba");
    expect(body.system).toBe("Devuelve JSON seguro.");
    expect(body.tool_choice).toEqual({ type: "tool", name: "propose_mission" });
    expect(body.tools).toHaveLength(1);
    expect(body.tools[0].name).toBe("propose_mission");
    expect(body.messages[0].role).toBe("user");
    expect(body.messages[0].content).toContain("Practicar sumas.");
    expect(body.max_tokens).toBeLessThanOrEqual(8192);
    expect(options!.signal).toBeDefined();
  });

  it("usa Claude Haiku 5.5 por defecto: rápido y barato para una propuesta que el servidor verifica", () => {
    expect(DEFAULT_ANTHROPIC_MODEL).toBe("claude-haiku-5-5");
    expect(new AnthropicProvider("k").model).toBe(DEFAULT_ANTHROPIC_MODEL);
  });

  it("en una reparación manda los errores y la propuesta anterior como datos", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(tool(missionFixtures[0]));
    await new AnthropicProvider("k", "m", fetchImpl).propose({
      ...input(),
      previousIssues: [{ code: "UNSOLVABLE", path: "mission", message: "No existe solución." }],
      previousProposal: { id: "viejo" },
    });
    const body = JSON.parse(fetchImpl.mock.calls[0]![1]!.body as string);
    expect(body.messages.at(-1).content).toContain("No existe solución.");
    expect(body.messages.at(-1).content).toContain("viejo");
  });

  it.each([401, 403, 429, 529, 500, 404])("normaliza el error HTTP %i sin filtrar cuerpo ni clave", async (status) => {
    const provider = new AnthropicProvider("clave-ficticia", "m", vi.fn<typeof fetch>().mockResolvedValue(new Response("dato-secreto-del-proveedor", { status })));
    const error = await provider.propose(input()).catch((e: unknown) => e as Error & { code: string });
    expect(error).toMatchObject({
      code: status === 401 || status === 403 ? "PROVIDER_AUTH" : status === 429 ? "PROVIDER_RATE_LIMIT" : "PROVIDER_UNAVAILABLE",
    });
    expect((error as Error).message).not.toContain("dato-secreto");
    expect((error as Error).message).not.toContain("clave-ficticia");
  });

  it("un error 400 del proveedor se trata como respuesta inválida (se puede reparar)", async () => {
    const provider = new AnthropicProvider("k", "m", vi.fn<typeof fetch>().mockResolvedValue(new Response("x", { status: 400 })));
    await expect(provider.propose(input())).rejects.toMatchObject({ code: "SCHEMA_INVALID" });
  });

  it.each([
    ["sin bloque de herramienta", reply([{ type: "text", text: "hola" }], "end_turn")],
    ["cortada por tamaño", reply([{ type: "tool_use", id: "t", name: "propose_mission", input: {} }], "max_tokens")],
    ["la herramienta equivocada", reply([{ type: "tool_use", id: "t", name: "otra", input: {} }])],
    ["entrada que no es objeto", tool("texto")],
    ["sobre vacío", Response.json({})],
    ["cuerpo no JSON", new Response("cuerpo no JSON")],
  ])("rechaza una respuesta no confiable: %s", async (_name, res) => {
    await expect(new AnthropicProvider("k", "m", vi.fn<typeof fetch>().mockResolvedValue(res)).propose(input())).rejects.toMatchObject({ code: "SCHEMA_INVALID" });
  });

  it("limita cuerpos incluso sin Content-Length", async () => {
    const res = new Response("x".repeat(MAX_GROQ_RESPONSE_BYTES + 1));
    await expect(new AnthropicProvider("k", "m", vi.fn<typeof fetch>().mockResolvedValue(res)).propose(input())).rejects.toMatchObject({ code: "PROVIDER_RESPONSE_TOO_LARGE" });
  });

  it("sin clave configurada no llama a la red", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(new AnthropicProvider("  ", "m", fetchImpl).propose(input())).rejects.toMatchObject({ code: "PROVIDER_NOT_CONFIGURED" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("propaga la cancelación a fetch y no filtra errores de red", async () => {
    const controller = new AbortController();
    controller.abort();
    const p = new AnthropicProvider("k", "m", vi.fn<typeof fetch>().mockRejectedValue(new Error("error interno")));
    await expect(p.propose({ ...input(), signal: controller.signal })).rejects.toMatchObject({ code: "PROVIDER_TIMEOUT" });
  });

  it("los mensajes de error hablan de Anthropic, no de Groq", async () => {
    const provider = new AnthropicProvider("k", "m", vi.fn<typeof fetch>().mockResolvedValue(new Response("", { status: 429 })));
    const error = (await provider.propose(input()).catch((e: unknown) => e)) as Error;
    expect(error.message).toMatch(/Anthropic/);
    expect(error.message).not.toMatch(/Groq/);
  });
});
